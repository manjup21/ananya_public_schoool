import fs from 'node:fs/promises';
import path from 'node:path';
import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const { Pool } = pg;

function required(name) {
  const v = process.env[name];
  if (!v || String(v).trim() === '') throw new Error(`Missing env var ${name} in backend/.env`);
  return v;
}

const pool = new Pool({
  host: required('PGHOST'),
  port: Number(required('PGPORT')),
  user: required('PGUSER'),
  password: required('PGPASSWORD'),
  database: required('PGDATABASE'),
});

const SCHEMAS_DIR = path.resolve(process.cwd(), 'src', 'schemas');

const FILE_TO_FUNCTIONS = {
  'users_functions.sql': [
    'atr_create_user',
    'atr_update_user',
    'atr_delete_user',
    'atr_get_users',
    'atr_get_user_by_id',
    // Auth helper used by backend login flow
    'atr_get_user_auth_by_email',
    'atr_get_user_auth_by_lecturer_employee_id',
  ],
  'lecturers_functions.sql': [
    'atr_create_lecturer',
    'atr_update_lecturer',
    'atr_delete_lecturer',
    'atr_get_lecturers',
    'atr_get_lecturer_by_id',
  ],
  'classes_functions.sql': ['atr_create_class', 'atr_update_class', 'atr_delete_class', 'atr_get_classes'],
  'sections_functions.sql': [
    'atr_create_section',
    'atr_update_section',
    'atr_delete_section',
  ],
  'subjects_functions.sql': [
    'create_subject',
    'update_subject',
    'delete_subject',
    'restore_subject',
    'toggle_subject_status',
    'get_subjects',
    'get_subject_by_id',
  ],
  'students_functions.sql': [
    'create_student',
    'get_students',
    'get_student_by_id',
    'update_student',
    'delete_student',
    'restore_student',
    'toggle_student_status',
    'atr_create_student',
    'atr_get_students',
    'atr_get_student_by_id',
    'atr_update_student',
    'atr_delete_student',
    'atr_restore_student',
    'atr_toggle_student_status',
  ],
  'examinations_functions.sql': [
    'atr_create_examination',
    'atr_get_examinations',
    'atr_get_examination_by_id',
    'atr_update_examination',
    'atr_cancel_examination',
  ],
};

async function fetchFunctionDef(fnName) {
  const { rows } = await pool.query(
    `
    SELECT pg_get_functiondef(p.oid) AS def
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = $1
    ORDER BY p.oid DESC
    LIMIT 1
    `,
    [fnName]
  );
  return rows?.[0]?.def ?? null;
}

function normalize(def) {
  return String(def || '')
    .replace(/\r\n/g, '\n')
    .trim()
    .replace(/\n{3,}/g, '\n\n');
}

function header(title) {
  return normalize(
    `-- ============================================================\n-- ${title}\n-- Synced from database: ${new Date().toISOString()}\n-- ============================================================\n`
  );
}

async function main() {
  const changes = [];

  for (const [file, fnNames] of Object.entries(FILE_TO_FUNCTIONS)) {
    const outPath = path.join(SCHEMAS_DIR, file);
    const defs = [];

    for (const fn of fnNames) {
      const def = await fetchFunctionDef(fn);
      if (!def) {
        console.warn(`[WARN] Function not found in DB: ${fn}`);
        continue;
      }
      defs.push(normalize(def) + '\n');
    }

    const title = file.replace(/_functions\.sql$/i, '').toUpperCase() + ' FUNCTIONS';
    const content = header(title) + '\n' + defs.join('\n');

    let prev = '';
    try {
      prev = await fs.readFile(outPath, 'utf8');
    } catch {
      prev = '';
    }

    if (normalize(prev) !== normalize(content)) {
      await fs.writeFile(outPath, content.replace(/\n/g, '\n'), 'utf8');
      changes.push(path.relative(process.cwd(), outPath));
    }
  }

  console.log('\nSynced function files:');
  if (!changes.length) console.log('  (no changes)');
  for (const c of changes) console.log('  -', c);
}

try {
  await main();
} finally {
  await pool.end().catch(() => {});
}

