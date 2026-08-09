import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 5432,
  user: process.env.DB_USER || 'kanban',
  password: process.env.DB_PASSWORD || 'kanban',
  database: process.env.DB_NAME || 'kanban',
});

export default pool;
