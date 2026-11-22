import pg from 'pg';
import { env } from '../utils/env.js';

const { Pool } = pg;

function buildPoolConfig() {
  if (env.databaseUrl && env.databaseUrl.trim() !== '') {
    return {
      connectionString: env.databaseUrl,
      ssl: env.pg.ssl,
    };
  }
  return {
    host: env.pg.host,
    port: env.pg.port,
    user: env.pg.user,
    password: env.pg.password,
    database: env.pg.database,
    ssl: env.pg.ssl,
  };
}

export const pool = new Pool({
  ...buildPoolConfig(),
  max: Number(process.env.PGPOOL_MAX) || 20,
  idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT_MS) || 30_000,
  connectionTimeoutMillis: Number(process.env.PG_CONNECTION_TIMEOUT_MS) || 10_000,
});

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL client error', err);
});

/**
 * Run a stored procedure that returns TABLE (status_code, message, data).
 * PostgreSQL folds unquoted identifiers to lowercase — functions are invoked as atr_*.
 *
 * @returns {Promise<object[]>} Row array only — NOT `{ rows }`. Use `rows[0]`, not `result.rows[0]`.
 */
export async function callProcedure(text, params = []) {
  const result = await pool.query(text, params);
  return result.rows;
}

/**
 * Same as `callProcedure`, named for plain SQL / functions outside the ATR_* envelope.
 * Returns the row array only — `const rows = await query(sql, params)`, not `{ rows }`.
 */
export const query = callProcedure;
