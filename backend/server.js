import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { scryptSync, randomBytes, timingSafeEqual, createHash } from 'crypto';
import pool from './db.js';
import { sendResetEmail } from './mailer.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const APP_URL = (process.env.APP_URL || 'http://localhost:8080').replace(/\/$/, '');
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LEN = 8;

// Express 4 doesn't forward async handler rejections to an error
// middleware — without these, one failed query kills the process.
process.on('unhandledRejection', (err) => console.error('[server] unhandled rejection', err));
process.on('uncaughtException', (err) => console.error('[server] uncaught exception', err));

// ---------- Rate limiting (in-memory, per-IP) ----------

function rateLimit({ windowMs, max }) {
  const hits = new Map();
  return (req, res, next) => {
    const key = req.ip;
    const now = Date.now();
    let rec = hits.get(key);
    if (!rec || rec.resetAt < now) {
      rec = { count: 0, resetAt: now + windowMs };
      hits.set(key, rec);
    }
    if (++rec.count > max) {
      return res.status(429).json({ error: 'Too many attempts. Please try again later.' });
    }
    next();
  };
}

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });
const resetLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 5 });

// ---------- Auth helpers ----------

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = (stored || '').split(':');
  if (!salt || !hash) return false;
  const test = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return test.length === expected.length && timingSafeEqual(test, expected);
}

async function createSession(userId) {
  const token = randomBytes(32).toString('hex');
  await pool.query(
    "INSERT INTO sessions (token, user_id, expires_at) VALUES ($1, $2, now() + interval '30 days')",
    [token, userId]
  );
  return token;
}

// Compared against when the email isn't registered, so login timing
// doesn't reveal whether an account exists.
const DUMMY_HASH = hashPassword(randomBytes(8).toString('hex'));

function bearerToken(req) {
  const header = req.get('authorization') || '';
  return header.startsWith('Bearer ') ? header.slice(7) : '';
}

async function getSessionUser(token) {
  if (!token) return null;
  const { rows } = await pool.query(
    `SELECT users.id, users.email, users.name FROM sessions
     JOIN users ON users.id = sessions.user_id
     WHERE sessions.token = $1 AND sessions.expires_at > now()`,
    [token]
  );
  return rows[0] || null;
}

// Gives a new account the legacy unowned demo data if it exists,
// otherwise seeds a starter workspace with a board and three columns.
async function seedUserData(userId) {
  await pool.query('UPDATE workspaces SET user_id = $1 WHERE user_id IS NULL', [userId]);
  const { rows } = await pool.query('SELECT id FROM workspaces WHERE user_id = $1', [userId]);
  if (rows.length) return;
  const { rows: ws } = await pool.query(
    'INSERT INTO workspaces (title, user_id) VALUES ($1, $2) RETURNING id',
    ['My Workspace', userId]
  );
  const { rows: bd } = await pool.query(
    'INSERT INTO boards (title, workspace_id) VALUES ($1, $2) RETURNING id',
    ['My first board', ws[0].id]
  );
  await pool.query(
    `INSERT INTO columns (title, position, board_id) VALUES
      ('To do', 0, $1), ('In progress', 1, $1), ('Done', 2, $1)`,
    [bd[0].id]
  );
}

// ---------- Auth routes (public) ----------

app.post('/api/auth/signup', authLimiter, async (req, res) => {
  const { name = '', email = '', password = '' } = req.body || {};
  const normalizedEmail = String(email).trim().toLowerCase();
  if (!EMAIL_RE.test(normalizedEmail)) {
    return res.status(400).json({ error: 'Enter a valid email address' });
  }
  if (password.length < MIN_PASSWORD_LEN) {
    return res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD_LEN} characters` });
  }
  try {
    const { rows } = await pool.query(
      'INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id, email, name',
      [normalizedEmail, hashPassword(password), String(name).trim() || normalizedEmail.split('@')[0]]
    );
    const user = rows[0];
    await seedUserData(user.id);
    const token = await createSession(user.id);
    res.status(201).json({ token, user });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }
    throw err;
  }
});

app.post('/api/auth/login', authLimiter, async (req, res) => {
  const { email = '', password = '' } = req.body || {};
  const { rows } = await pool.query(
    'SELECT id, email, name, password_hash FROM users WHERE email = $1',
    [String(email).trim().toLowerCase()]
  );
  const user = rows[0];
  if (!verifyPassword(password, user?.password_hash || DUMMY_HASH) || !user) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  await pool.query('DELETE FROM sessions WHERE expires_at < now()');
  const token = await createSession(user.id);
  res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
});

// Always answers 200 so the endpoint can't be used to enumerate accounts;
// the email is only sent when a matching user actually exists.
app.post('/api/auth/forgot-password', resetLimiter, async (req, res) => {
  res.json({ ok: true });
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!EMAIL_RE.test(email)) return;
    const { rows } = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (!rows[0]) return;
    const token = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    await pool.query('DELETE FROM password_resets WHERE user_id = $1', [rows[0].id]);
    await pool.query(
      "INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES ($1, $2, now() + interval '1 hour')",
      [rows[0].id, tokenHash]
    );
    await sendResetEmail(email, `${APP_URL}/#/reset-password/${token}`);
  } catch (err) {
    console.error('[auth] forgot-password failed', err);
  }
});

app.post('/api/auth/reset-password', authLimiter, async (req, res) => {
  const { token = '', password = '' } = req.body || {};
  if (password.length < MIN_PASSWORD_LEN) {
    return res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD_LEN} characters` });
  }
  const tokenHash = createHash('sha256').update(String(token)).digest('hex');
  const { rows } = await pool.query(
    'SELECT id, user_id FROM password_resets WHERE token_hash = $1 AND expires_at > now()',
    [tokenHash]
  );
  const reset = rows[0];
  if (!reset) {
    return res.status(400).json({ error: 'This reset link is invalid or has expired' });
  }
  await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hashPassword(password), reset.user_id]);
  await pool.query('DELETE FROM password_resets WHERE user_id = $1', [reset.user_id]);
  await pool.query('DELETE FROM sessions WHERE user_id = $1', [reset.user_id]);
  res.json({ ok: true });
});

// ---------- Auth middleware ----------

app.use('/api', async (req, res, next) => {
  try {
    const user = await getSessionUser(bearerToken(req));
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
});

app.get('/api/auth/me', (req, res) => res.json(req.user));

app.post('/api/auth/logout', async (req, res) => {
  const token = bearerToken(req);
  if (token) await pool.query('DELETE FROM sessions WHERE token = $1', [token]);
  res.sendStatus(204);
});

// ---------- Ownership helpers ----------

async function ownsWorkspace(userId, id) {
  const { rows } = await pool.query(
    'SELECT 1 FROM workspaces WHERE id = $1 AND user_id = $2', [id, userId]);
  return !!rows[0];
}

async function ownsBoard(userId, id) {
  const { rows } = await pool.query(
    `SELECT 1 FROM boards b JOIN workspaces w ON b.workspace_id = w.id
     WHERE b.id = $1 AND w.user_id = $2`, [id, userId]);
  return !!rows[0];
}

async function ownsColumn(userId, id) {
  const { rows } = await pool.query(
    `SELECT 1 FROM columns c
     JOIN boards b ON c.board_id = b.id
     JOIN workspaces w ON b.workspace_id = w.id
     WHERE c.id = $1 AND w.user_id = $2`, [id, userId]);
  return !!rows[0];
}

async function ownsCard(userId, id) {
  const { rows } = await pool.query(
    `SELECT 1 FROM cards k
     JOIN columns c ON k.column_id = c.id
     JOIN boards b ON c.board_id = b.id
     JOIN workspaces w ON b.workspace_id = w.id
     WHERE k.id = $1 AND w.user_id = $2`, [id, userId]);
  return !!rows[0];
}

// Workspaces
app.get('/api/workspaces', async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM workspaces WHERE user_id = $1 ORDER BY id', [req.user.id]);
  res.json(rows);
});

app.get('/api/workspaces/:id', async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM workspaces WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Workspace not found' });
  res.json(rows[0]);
});

app.post('/api/workspaces', async (req, res) => {
  const { title } = req.body;
  const { rows } = await pool.query(
    'INSERT INTO workspaces (title, user_id) VALUES ($1, $2) RETURNING *',
    [title, req.user.id]
  );
  res.status(201).json(rows[0]);
});

app.patch('/api/workspaces/:id', async (req, res) => {
  const { id } = req.params;
  const { title } = req.body;
  const { rows } = await pool.query(
    'UPDATE workspaces SET title = $1 WHERE id = $2 AND user_id = $3 RETURNING *',
    [title, id, req.user.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Workspace not found' });
  res.json(rows[0]);
});

app.delete('/api/workspaces/:id', async (req, res) => {
  const { id } = req.params;
  const { rows } = await pool.query(
    'DELETE FROM workspaces WHERE id = $1 AND user_id = $2 RETURNING id', [id, req.user.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Workspace not found' });
  res.sendStatus(204);
});

// Boards
app.get('/api/boards', async (req, res) => {
  const archived = req.query.archived === 'true';
  const workspaceId = req.query.workspace_id;
  if (!workspaceId) {
    return res.status(400).json({ error: 'workspace_id is required' });
  }
  if (!(await ownsWorkspace(req.user.id, workspaceId))) {
    return res.status(404).json({ error: 'Workspace not found' });
  }
  const { rows } = await pool.query(
    'SELECT * FROM boards WHERE workspace_id = $1 AND archived = $2 ORDER BY starred DESC, id',
    [workspaceId, archived]
  );
  res.json(rows);
});

app.get('/api/boards/:id', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT b.* FROM boards b JOIN workspaces w ON b.workspace_id = w.id
     WHERE b.id = $1 AND w.user_id = $2`,
    [req.params.id, req.user.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Board not found' });
  res.json(rows[0]);
});

app.post('/api/boards', async (req, res) => {
  const { title, workspace_id, columns = [] } = req.body;
  if (!workspace_id) {
    return res.status(400).json({ error: 'workspace_id is required' });
  }
  if (!(await ownsWorkspace(req.user.id, workspace_id))) {
    return res.status(404).json({ error: 'Workspace not found' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      'INSERT INTO boards (title, workspace_id) VALUES ($1, $2) RETURNING *',
      [title, workspace_id]
    );
    const board = rows[0];
    for (let i = 0; i < columns.length; i++) {
      await client.query(
        'INSERT INTO columns (title, position, board_id) VALUES ($1, $2, $3)',
        [columns[i], i, board.id]
      );
    }
    await client.query('COMMIT');
    res.status(201).json(board);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

app.patch('/api/boards/:id', async (req, res) => {
  const { id } = req.params;
  if (!(await ownsBoard(req.user.id, id))) {
    return res.status(404).json({ error: 'Board not found' });
  }
  const { rows: existingRows } = await pool.query('SELECT * FROM boards WHERE id = $1', [id]);
  if (!existingRows[0]) return res.status(404).json({ error: 'Board not found' });
  const existing = existingRows[0];
  const {
    title = existing.title,
    starred = existing.starred,
    archived = existing.archived
  } = req.body;
  const { rows } = await pool.query(
    'UPDATE boards SET title = $1, starred = $2, archived = $3 WHERE id = $4 RETURNING *',
    [title, starred, archived, id]
  );
  res.json(rows[0]);
});

app.delete('/api/boards/:id', async (req, res) => {
  const { id } = req.params;
  if (!(await ownsBoard(req.user.id, id))) {
    return res.status(404).json({ error: 'Board not found' });
  }
  await pool.query('DELETE FROM boards WHERE id = $1', [id]);
  res.sendStatus(204);
});

// Columns
app.get('/api/columns', async (req, res) => {
  const { board_id } = req.query;
  if (!(await ownsBoard(req.user.id, board_id))) {
    return res.status(404).json({ error: 'Board not found' });
  }
  const { rows } = await pool.query(
    'SELECT * FROM columns WHERE board_id = $1 ORDER BY position',
    [board_id]
  );
  res.json(rows);
});

app.post('/api/columns', async (req, res) => {
  const { title, position, board_id } = req.body;
  if (!(await ownsBoard(req.user.id, board_id))) {
    return res.status(404).json({ error: 'Board not found' });
  }
  const { rows } = await pool.query(
    'INSERT INTO columns (title, position, board_id) VALUES ($1, $2, $3) RETURNING *',
    [title, position, board_id]
  );
  res.status(201).json(rows[0]);
});

// Cards
app.get('/api/cards', async (req, res) => {
  const { board_id } = req.query;
  if (!board_id) {
    return res.status(400).json({ error: 'board_id is required' });
  }
  if (!(await ownsBoard(req.user.id, board_id))) {
    return res.status(404).json({ error: 'Board not found' });
  }
  const archived = req.query.archived || 'false';
  let filter = '';
  const params = [board_id];
  if (archived === 'true') {
    filter = 'AND cards.archived = true';
  } else if (archived === 'false') {
    filter = 'AND cards.archived = false';
  } else if (archived !== 'all') {
    return res.status(400).json({ error: 'archived must be true, false, or all' });
  }
  const { rows } = await pool.query(
    `SELECT cards.* FROM cards
     JOIN columns ON cards.column_id = columns.id
     WHERE columns.board_id = $1 ${filter}
     ORDER BY cards.position`,
    params
  );
  res.json(rows);
});

app.post('/api/cards', async (req, res) => {
  const { title, description, column_id, position, meta } = req.body;
  if (!(await ownsColumn(req.user.id, column_id))) {
    return res.status(404).json({ error: 'Column not found' });
  }
  const { rows } = await pool.query(
    'INSERT INTO cards (title, description, column_id, position, meta) VALUES ($1, $2, $3, $4, $5) RETURNING *',
    [title, description, column_id, position, JSON.stringify(meta || {})]
  );
  res.status(201).json(rows[0]);
});

app.put('/api/cards/:id', async (req, res) => {
  const { id } = req.params;
  if (!(await ownsCard(req.user.id, id))) {
    return res.status(404).json({ error: 'Card not found' });
  }
  const { rows: existingRows } = await pool.query('SELECT * FROM cards WHERE id = $1', [id]);
  if (!existingRows[0]) return res.status(404).json({ error: 'Card not found' });
  const existing = existingRows[0];
  const {
    title = existing.title,
    description = existing.description,
    column_id = existing.column_id,
    position = existing.position,
    meta = existing.meta,
    archived = existing.archived,
    completed = existing.completed
  } = req.body;
  const { rows } = await pool.query(
    `UPDATE cards SET title = $1, description = $2, column_id = $3, position = $4, meta = $5, archived = $6, completed = $7
     WHERE id = $8 RETURNING *`,
    [title, description, column_id, position, JSON.stringify(meta || {}), archived, completed, id]
  );
  res.json(rows[0]);
});

app.delete('/api/cards/:id', async (req, res) => {
  const { id } = req.params;
  if (!(await ownsCard(req.user.id, id))) {
    return res.status(404).json({ error: 'Card not found' });
  }
  await pool.query('DELETE FROM cards WHERE id = $1', [id]);
  res.sendStatus(204);
});

// Move card
app.patch('/api/cards/:id/move', async (req, res) => {
  const { id } = req.params;
  const { column_id, position } = req.body;
  if (!(await ownsCard(req.user.id, id)) || !(await ownsColumn(req.user.id, column_id))) {
    return res.status(404).json({ error: 'Card not found' });
  }
  const { rows } = await pool.query(
    'UPDATE cards SET column_id = $1, position = $2 WHERE id = $3 RETURNING *',
    [column_id, position, id]
  );
  res.json(rows[0]);
});

app.patch('/api/columns/:id/archive', async (req, res) => {
  const { id } = req.params;
  if (!(await ownsColumn(req.user.id, id))) {
    return res.status(404).json({ error: 'Column not found' });
  }
  await pool.query('UPDATE cards SET archived = true WHERE column_id = $1 AND archived = false', [id]);
  res.sendStatus(204);
});

app.patch('/api/columns/:id/archive-completed', async (req, res) => {
  const { id } = req.params;
  if (!(await ownsColumn(req.user.id, id))) {
    return res.status(404).json({ error: 'Column not found' });
  }
  await pool.query('UPDATE cards SET archived = true WHERE column_id = $1 AND archived = false AND completed = true', [id]);
  res.sendStatus(204);
});

app.patch('/api/columns/reorder', async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || !ids.length) {
    return res.status(400).json({ error: 'ids must be a non-empty array' });
  }
  const { rows: owned } = await pool.query(
    `SELECT count(*)::int AS c FROM columns c
     JOIN boards b ON c.board_id = b.id
     JOIN workspaces w ON b.workspace_id = w.id
     WHERE c.id = ANY($1::int[]) AND w.user_id = $2`,
    [ids, req.user.id]
  );
  if (owned[0].c !== ids.length) {
    return res.status(404).json({ error: 'Column not found' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (let i = 0; i < ids.length; i++) {
      await client.query('UPDATE columns SET position = $1 WHERE id = $2', [i, ids[i]]);
    }
    await client.query('COMMIT');
    res.sendStatus(204);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

app.patch('/api/columns/:id', async (req, res) => {
  const { id } = req.params;
  const { title } = req.body;
  if (!(await ownsColumn(req.user.id, id))) {
    return res.status(404).json({ error: 'Column not found' });
  }
  const { rows } = await pool.query(
    'UPDATE columns SET title = $1 WHERE id = $2 RETURNING *',
    [title, id]
  );
  res.json(rows[0]);
});

app.delete('/api/columns/:id', async (req, res) => {
  const { id } = req.params;
  if (!(await ownsColumn(req.user.id, id))) {
    return res.status(404).json({ error: 'Column not found' });
  }
  await pool.query('DELETE FROM columns WHERE id = $1', [id]);
  res.sendStatus(204);
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
