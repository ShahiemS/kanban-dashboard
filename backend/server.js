import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pool from './db.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'demo1234';

// Auth - this is a lightweight shared-password gate for demo purposes only,
// not a real authentication system.
app.post('/api/auth/login', (req, res) => {
  const { password } = req.body || {};
  if (password === DEMO_PASSWORD) return res.json({ ok: true });
  res.status(401).json({ ok: false, error: 'Invalid password' });
});

app.use('/api', (req, res, next) => {
  if (req.path === '/auth/login') return next();
  if (req.get('x-demo-password') !== DEMO_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});

// Boards
app.get('/api/boards', async (req, res) => {
  const archived = req.query.archived === 'true';
  const { rows } = await pool.query(
    'SELECT * FROM boards WHERE archived = $1 ORDER BY starred DESC, id',
    [archived]
  );
  res.json(rows);
});

app.get('/api/boards/:id', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM boards WHERE id = $1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Board not found' });
  res.json(rows[0]);
});

app.post('/api/boards', async (req, res) => {
  const { title } = req.body;
  const { rows } = await pool.query(
    'INSERT INTO boards (title) VALUES ($1) RETURNING *',
    [title]
  );
  res.status(201).json(rows[0]);
});

app.patch('/api/boards/:id', async (req, res) => {
  const { id } = req.params;
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
  await pool.query('DELETE FROM boards WHERE id = $1', [id]);
  res.sendStatus(204);
});

// Columns
app.get('/api/columns', async (req, res) => {
  const { board_id } = req.query;
  const { rows } = await pool.query(
    'SELECT * FROM columns WHERE board_id = $1 ORDER BY position',
    [board_id]
  );
  res.json(rows);
});

app.post('/api/columns', async (req, res) => {
  const { title, position, board_id } = req.body;
  const { rows } = await pool.query(
    'INSERT INTO columns (title, position, board_id) VALUES ($1, $2, $3) RETURNING *',
    [title, position, board_id]
  );
  res.status(201).json(rows[0]);
});

// Cards
app.get('/api/cards', async (req, res) => {
  const { board_id } = req.query;
  const { rows } = await pool.query(
    `SELECT cards.* FROM cards
     JOIN columns ON cards.column_id = columns.id
     WHERE columns.board_id = $1 AND cards.archived = false
     ORDER BY cards.position`,
    [board_id]
  );
  res.json(rows);
});

app.post('/api/cards', async (req, res) => {
  const { title, description, column_id, position, meta } = req.body;
  const { rows } = await pool.query(
    'INSERT INTO cards (title, description, column_id, position, meta) VALUES ($1, $2, $3, $4, $5) RETURNING *',
    [title, description, column_id, position, JSON.stringify(meta || {})]
  );
  res.status(201).json(rows[0]);
});

app.put('/api/cards/:id', async (req, res) => {
  const { id } = req.params;
  const { title, description, column_id, position, meta } = req.body;
  const { rows } = await pool.query(
    `UPDATE cards SET title = $1, description = $2, column_id = $3, position = $4, meta = $5
     WHERE id = $6 RETURNING *`,
    [title, description, column_id, position, JSON.stringify(meta || {}), id]
  );
  res.json(rows[0]);
});

app.delete('/api/cards/:id', async (req, res) => {
  const { id } = req.params;
  await pool.query('DELETE FROM cards WHERE id = $1', [id]);
  res.sendStatus(204);
});

// Move card
app.patch('/api/cards/:id/move', async (req, res) => {
  const { id } = req.params;
  const { column_id, position } = req.body;
  const { rows } = await pool.query(
    'UPDATE cards SET column_id = $1, position = $2 WHERE id = $3 RETURNING *',
    [column_id, position, id]
  );
  res.json(rows[0]);
});

app.patch('/api/columns/:id/archive', async (req, res) => {
  const { id } = req.params;
  await pool.query('UPDATE cards SET archived = true WHERE column_id = $1 AND archived = false', [id]);
  res.sendStatus(204);
});

app.patch('/api/columns/reorder', async (req, res) => {
  const { ids } = req.body;
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
  const { rows } = await pool.query(
    'UPDATE columns SET title = $1 WHERE id = $2 RETURNING *',
    [title, id]
  );
  res.json(rows[0]);
});

app.delete('/api/columns/:id', async (req, res) => {
  const { id } = req.params;
  await pool.query('DELETE FROM columns WHERE id = $1', [id]);
  res.sendStatus(204);
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
