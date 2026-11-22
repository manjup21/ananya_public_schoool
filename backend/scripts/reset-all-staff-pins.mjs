/**
 * Deploy helper for staff/admin 6-digit PIN login.
 * Resets every users.password_hash to bcrypt(STAFF_DEFAULT_PIN).
 * After this, login with the default PIN forces Set PIN.
 *
 * Usage (from backend/, with .env pointing at the target DB):
 *   node scripts/reset-all-staff-pins.mjs
 */
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import { STAFF_DEFAULT_PIN } from '../src/utils/staffPin.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
config({ path: resolve(root, '.env') });

const { pool } = await import('../src/db/db.js');

const rounds = Number(process.env.BCRYPT_ROUNDS) || 10;
const hash = await bcrypt.hash(STAFF_DEFAULT_PIN, rounds);
const before = await pool.query('SELECT count(*)::int AS n FROM public.users');
const updated = await pool.query(
  'UPDATE public.users SET password_hash = $1 RETURNING id, email, name',
  [hash]
);

console.log(`Reset ${updated.rowCount} of ${before.rows[0].n} user(s) to the default staff PIN.`);
for (const row of updated.rows) {
  console.log(` - ${row.email} (${row.name})`);
}
await pool.end();
