import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pool from './db.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Columns
app.get('/api/columns', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM columns ORDER BY position');
  res.json(rows);
});

app.post('/api/columns', async (req, res) => {
  const { title, position } = req.body;
  const { rows } = await pool.query(
    'INSERT INTO columns (title, position) VALUES ($1, $2) RETURNING *',
    [title, position]
  );
  res.status(201).json(rows[0]);
});

// Cards
app.get('/api/cards', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM cards ORDER BY position');
  res.json(rows);
});

app.post('/api/cards', async (req, res) => {
  const { title, description, column_id, position } = req.body;
  const { rows } = await pool.query(
    'INSERT INTO cards (title, description, column_id, position) VALUES ($1, $2, $3, $4) RETURNING *',
    [title, description, column_id, position]
  );
  res.status(201).json(rows[0]);
});

app.put('/api/cards/:id', async (req, res) => {
  const { id } = req.params;
  const { title, description, column_id, position } = req.body;
  const { rows } = await pool.query(
    `UPDATE cards SET title = $1, description = $2, column_id = $3, position = $4
     WHERE id = $5 RETURNING *`,
    [title, description, column_id, position, id]
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

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
