import fs from 'fs';
import pool from './db.js';

const schema = fs.readFileSync('./init.sql', 'utf8');

await pool.query(schema);
console.log('Migrations applied');

const { rows } = await pool.query('SELECT COUNT(*) FROM columns');
if (parseInt(rows[0].count, 10) === 0) {
  await pool.query(`
    INSERT INTO columns (title, position) VALUES
      ('To Do', 0),
      ('In Progress', 1),
      ('Done', 2)
  `);
  console.log('Default columns seeded');
}

await pool.end();
