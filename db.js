const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432,
  database: process.env.DB_NAME || 'geofence_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASS || 'password',
});

// Wrap query to catch and log errors gracefully to prevent crashes when PG is offline
const originalQuery = pool.query.bind(pool);
pool.query = async function(...args) {
  try {
    return await originalQuery(...args);
  } catch (err) {
    console.error('[Database Error] PostgreSQL query failed:', err.message);
    if (err.code === 'ECONNREFUSED' || err.message.includes('connect')) {
      console.warn('[Database Warning] PostgreSQL is offline. Returning empty rows fallback.');
      return { rows: [] };
    }
    throw err;
  }
};

module.exports = pool;