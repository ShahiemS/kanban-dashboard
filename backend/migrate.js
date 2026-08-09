import fs from 'fs';
import pool from './db.js';

const schema = fs.readFileSync('./init.sql', 'utf8');

await pool.query(schema);
console.log('Migrations applied');

const { rows: boardCount } = await pool.query('SELECT COUNT(*) FROM boards');
if (parseInt(boardCount[0].count, 10) === 0) {
  await pool.query(`INSERT INTO boards (title) VALUES ('Default')`);
  console.log('Default board seeded');
}

const { rows: defaultBoard } = await pool.query('SELECT id FROM boards LIMIT 1');
await pool.query('UPDATE columns SET board_id = $1 WHERE board_id IS NULL', [defaultBoard[0].id]);

const { rows } = await pool.query('SELECT COUNT(*) FROM columns');
if (parseInt(rows[0].count, 10) === 0) {
  await pool.query(`
    INSERT INTO columns (title, position, board_id) VALUES
      ('To Do', 0, $1),
      ('In Progress', 1, $1),
      ('Done', 2, $1)
  `, [defaultBoard[0].id]);
  console.log('Default columns seeded');
}

await pool.end();
