import path from 'node:path';
import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const { Pool } = pg;

const pool = new Pool({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT),
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
});

async function listByPatterns(patterns) {
  const where = patterns.map((_, i) => `p.proname ILIKE $${i + 1}`).join(' OR ');
  const sql = `
    SELECT n.nspname AS schema,
           p.proname AS name,
           pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
      AND (${where})
    ORDER BY schema, name, args;
  `;
  const { rows } = await pool.query(sql, patterns);
  return rows;
}

async function listPublicAtr() {
  const sql = `
    SELECT p.proname AS name,
           pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname ILIKE 'atr\\_%' ESCAPE '\\'
    ORDER BY 1, 2;
  `;
  const { rows } = await pool.query(sql);
  return rows;
}

async function main() {
  const patterns = ['%authenticate%', '%get_class%', '%get_sections%', '%get_section%'];
  const matches = await listByPatterns(patterns);

  console.log('\nMatches for name patterns:', patterns);
  if (!matches.length) console.log('  (none)');
  for (const r of matches) console.log(`  - ${r.schema}.${r.name}(${r.args})`);

  const atr = await listPublicAtr();
  console.log('\npublic atr_* functions:');
  for (const r of atr) console.log(`  - ${r.name}(${r.args})`);
}

try {
  await main();
} finally {
  await pool.end().catch(() => {});
}

