/**
 * Ananya Public School — light test seed for PDF / exam flows.
 *
 * Creates (re-runnable: clears prior APS-* rolls / Ananya seed exams first):
 * - Class: Class 8 · Section: A
 * - Subjects: English, Kannada, Hindi, Mathematics, Science, Social Science
 * - Exam types: FA1, FA2, SA1
 * - 5 students (Chikkabennuru / Chitradurga addresses)
 * - 2 completed exams with published marks (FA1 + SA1) — progress / exam report PDFs
 * - 1 scheduled exam (FA2) — hall ticket PDF
 * - Fees + payments for 3 students — fee statement / receipt PDFs
 *
 * Usage (from backend/):
 *   node scripts/seed-ananya-pdf-test.mjs
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

function buildPoolConfig() {
  const url = (process.env.DATABASE_URL ?? '').trim();
  if (url) {
    return {
      connectionString: url,
      ssl:
        process.env.PGSSL === 'true'
          ? { rejectUnauthorized: process.env.PGSSL_REJECT_UNAUTHORIZED !== 'false' }
          : false,
    };
  }
  return {
    host: process.env.PGHOST ?? 'localhost',
    port: Number(process.env.PGPORT) || 5432,
    user: process.env.PGUSER ?? '',
    password: process.env.PGPASSWORD ?? '',
    database: process.env.PGDATABASE ?? '',
    ssl:
      process.env.PGSSL === 'true'
        ? { rejectUnauthorized: process.env.PGSSL_REJECT_UNAUTHORIZED !== 'false' }
        : false,
  };
}

const CLASS_NAME = 'Class 8';
const SECTION_CODE = 'A';
const EXAM_NAME_PREFIX = 'Ananya — ';

const SUBJECTS = [
  { name: 'English', code: 'ENG', sort: 1 },
  { name: 'Kannada', code: 'KAN', sort: 2 },
  { name: 'Hindi', code: 'HIN', sort: 3 },
  { name: 'Mathematics', code: 'MAT', sort: 4 },
  { name: 'Science', code: 'SCI', sort: 5 },
  { name: 'Social Science', code: 'SST', sort: 6 },
];

/** marksFa1 / marksSa1 length must match SUBJECTS */
const STUDENTS = [
  {
    roll: 'APS-8A-01',
    first: 'Aditi',
    last: 'Shetty',
    gender: 'female',
    father: 'Ramesh Shetty',
    mother: 'Lakshmi Shetty',
    dob: '2012-04-12',
    phone: '9902000001',
    blood: 'O+',
    city: 'Chikkabennuru',
    district: 'Chitradurga',
    pin: '577501',
    marksFa1: [78, 72, 81, 76, 85, 79],
    marksSa1: [82, 75, 84, 80, 88, 83],
    fee: { total: 25000, discount: 1000, paid: 12000 },
  },
  {
    roll: 'APS-8A-02',
    first: 'Karthik',
    last: 'Gowda',
    gender: 'male',
    father: 'Suresh Gowda',
    mother: 'Sunita Gowda',
    dob: '2012-07-03',
    phone: '9902000002',
    blood: 'B+',
    city: 'Chikkabennuru',
    district: 'Chitradurga',
    pin: '577501',
    marksFa1: [65, 68, 70, 62, 74, 71],
    marksSa1: [70, 72, 73, 68, 78, 75],
    fee: { total: 25000, discount: 0, paid: 25000 },
  },
  {
    roll: 'APS-8A-03',
    first: 'Nidhi',
    last: 'Patil',
    gender: 'female',
    father: 'Mahesh Patil',
    mother: 'Anita Patil',
    dob: '2012-01-22',
    phone: '9902000003',
    blood: 'A+',
    city: 'Chitradurga',
    district: 'Chitradurga',
    pin: '577501',
    marksFa1: [88, 84, 90, 86, 92, 89],
    marksSa1: [91, 87, 93, 89, 95, 90],
    fee: { total: 28000, discount: 2000, paid: 5000 },
  },
  {
    roll: 'APS-8A-04',
    first: 'Rahul',
    last: 'Naik',
    gender: 'male',
    father: 'Prakash Naik',
    mother: 'Geeta Naik',
    dob: '2012-11-15',
    phone: '9902000004',
    blood: 'AB+',
    city: 'Chikkabennuru',
    district: 'Chitradurga',
    pin: '577502',
    marksFa1: [55, 58, 61, 52, 64, 59],
    marksSa1: [60, 63, 66, 58, 70, 65],
    fee: null,
  },
  {
    roll: 'APS-8A-05',
    first: 'Sneha',
    last: 'Hegde',
    gender: 'female',
    father: 'Anand Hegde',
    mother: 'Kavitha Hegde',
    dob: '2012-09-08',
    phone: '9902000005',
    blood: 'O-',
    city: 'Chikkabennuru',
    district: 'Chitradurga',
    pin: '577501',
    marksFa1: [72, 75, 69, 73, 80, 77],
    /** one absent subject on SA1 for variety */
    marksSa1: [76, 78, null, 75, 84, 80],
    fee: null,
  },
];

async function ensureSubject(client, { name, code, sort }, actorId) {
  const {
    rows: [existing],
  } = await client.query(
    `SELECT id, name, code FROM subjects
     WHERE is_deleted = FALSE AND LOWER(name) = LOWER($1)
     LIMIT 1`,
    [name]
  );
  if (existing) return existing;

  const {
    rows: [row],
  } = await client.query(
    `INSERT INTO subjects (name, code, sort_order, is_active, is_deleted, created_by, updated_by)
     VALUES ($1, $2, $3, TRUE, FALSE, $4::uuid, $4::uuid)
     RETURNING id, name, code`,
    [name, code, sort, actorId]
  );
  return row;
}

async function ensureExamType(client, name, sortOrder) {
  const {
    rows: [existing],
  } = await client.query(`SELECT id, name FROM exam_types WHERE LOWER(name) = LOWER($1) LIMIT 1`, [name]);
  if (existing) return existing;

  const {
    rows: [row],
  } = await client.query(
    `INSERT INTO exam_types (name, is_system, sort_order) VALUES ($1, FALSE, $2) RETURNING id, name`,
    [name, sortOrder]
  );
  return row;
}

async function ensureClass(client, name, actorId) {
  const {
    rows: [existing],
  } = await client.query(`SELECT id, name FROM classes WHERE LOWER(name) = LOWER($1) LIMIT 1`, [name]);
  if (existing) return existing;

  const {
    rows: [row],
  } = await client.query(
    `INSERT INTO classes (name, is_active, created_by, updated_by)
     VALUES ($1, TRUE, $2::uuid, $2::uuid)
     RETURNING id, name`,
    [name, actorId]
  );
  return row;
}

async function ensureSection(client, classId, sectionCode, actorId) {
  const {
    rows: [existing],
  } = await client.query(
    `SELECT id, class_id, section_code FROM sections
     WHERE class_id = $1::uuid AND LOWER(section_code) = LOWER($2)
     LIMIT 1`,
    [classId, sectionCode]
  );
  if (existing) return existing;

  const {
    rows: [row],
  } = await client.query(
    `INSERT INTO sections (class_id, section_code, is_active, created_by, updated_by)
     VALUES ($1::uuid, $2, TRUE, $3::uuid, $3::uuid)
     RETURNING id, class_id, section_code`,
    [classId, sectionCode, actorId]
  );
  return row;
}

function isoOffsetDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

async function insertExamWithSubjects(
  client,
  {
    testName,
    examTypeId,
    classId,
    sectionId,
    examDate,
    status,
    invigilator,
    instructions,
    subjectRows,
    perMax,
    perPass,
    actorId,
    startTime = '09:00',
    endTime = '12:00',
  }
) {
  const totalMax = perMax.reduce((a, b) => a + b, 0);
  const totalPass = perPass.reduce((a, b) => a + b, 0);

  const {
    rows: [exam],
  } = await client.query(
    `INSERT INTO examinations (
      test_name, exam_type_id, exam_status, class_id, section_id,
      exam_date, start_time, end_time, max_marks, passing_marks,
      invigilator, instructions, created_by, updated_by
    ) VALUES (
      $1, $2::uuid, $3, $4::uuid, $5::uuid,
      $6::date, $7::time, $8::time, $9, $10,
      $11, $12, $13::uuid, $13::uuid
    ) RETURNING id, test_name, exam_status`,
    [
      testName,
      examTypeId,
      status,
      classId,
      sectionId,
      examDate,
      startTime,
      endTime,
      totalMax,
      totalPass,
      invigilator,
      instructions,
      actorId,
    ]
  );

  await client.query(
    `INSERT INTO examination_sections (examination_id, section_id)
     VALUES ($1::uuid, $2::uuid) ON CONFLICT DO NOTHING`,
    [exam.id, sectionId]
  );

  for (let i = 0; i < subjectRows.length; i++) {
    const subDate = new Date(`${examDate}T00:00:00`);
    subDate.setDate(subDate.getDate() + i);
    await client.query(
      `INSERT INTO examination_subjects (
         examination_id, subject_id, max_marks, passing_marks,
         exam_date, start_time, end_time, is_part_b
       ) VALUES (
         $1::uuid, $2::uuid, $3, $4,
         $5::date, $6::time, $7::time, FALSE
       )`,
      [exam.id, subjectRows[i].id, perMax[i], perPass[i], subDate.toISOString().slice(0, 10), startTime, endTime]
    );
  }

  return exam;
}

async function publishResults(client, examId, studentIds, subjectRows, marksKey, actorId) {
  for (const st of studentIds) {
    const marks = st[marksKey];
    const {
      rows: [res],
    } = await client.query(
      `INSERT INTO examination_results (
        examination_id, student_id, total_marks, result_status, created_by, updated_by
      ) VALUES ($1::uuid, $2::uuid, NULL, 'published', $3::uuid, $3::uuid)
      RETURNING id`,
      [examId, st.id, actorId]
    );

    let total = 0;
    for (let i = 0; i < subjectRows.length; i++) {
      const mark = marks[i];
      const absent = mark == null;
      if (!absent) total += mark;
      await client.query(
        `INSERT INTO examination_result_marks (result_id, subject_id, mark, is_absent, remarks)
         VALUES ($1::uuid, $2::uuid, $3, $4, $5)`,
        [res.id, subjectRows[i].id, absent ? null : mark, absent, absent ? 'Absent (seed)' : null]
      );
    }
    await client.query(`UPDATE examination_results SET total_marks = $2 WHERE id = $1::uuid`, [
      res.id,
      total,
    ]);
  }
}

async function main() {
  const pool = new pg.Pool({ ...buildPoolConfig(), max: 5 });
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const {
      rows: [userRow],
    } = await client.query(`SELECT id, email FROM users ORDER BY created_at ASC NULLS LAST LIMIT 1`);
    if (!userRow?.id) throw new Error('No users found — create a login user first.');
    const actorId = userRow.id;
    console.log(`Using actor: ${userRow.email ?? actorId}`);

    await client.query(
      `UPDATE users
       SET is_admin = TRUE, is_super_admin = TRUE, can_manage_fees = TRUE, role = 'lecturer'
       WHERE id = $1::uuid`,
      [actorId]
    );

    const classRow = await ensureClass(client, CLASS_NAME, actorId);
    const section = await ensureSection(client, classRow.id, SECTION_CODE, actorId);
    console.log(`Class/section: ${classRow.name} / ${section.section_code}`);

    const subjectRows = [];
    for (const s of SUBJECTS) {
      subjectRows.push(await ensureSubject(client, s, actorId));
    }
    const fa1Type = await ensureExamType(client, 'FA1', 1);
    const fa2Type = await ensureExamType(client, 'FA2', 2);
    const sa1Type = await ensureExamType(client, 'SA1', 3);

    const rolls = STUDENTS.map((s) => s.roll);

    // Clear previous seed fees → results → students → exams
    await client.query(
      `DELETE FROM fee_payments
       WHERE student_fee_id IN (
         SELECT sf.id FROM student_fees sf
         JOIN students s ON s.id = sf.student_id
         WHERE s.roll_number = ANY($1::varchar[])
       )`,
      [rolls]
    );
    await client.query(
      `DELETE FROM student_fee_items
       WHERE student_fee_id IN (
         SELECT sf.id FROM student_fees sf
         JOIN students s ON s.id = sf.student_id
         WHERE s.roll_number = ANY($1::varchar[])
       )`,
      [rolls]
    );
    await client.query(
      `DELETE FROM student_fees
       WHERE student_id IN (SELECT id FROM students WHERE roll_number = ANY($1::varchar[]))`,
      [rolls]
    );
    await client.query(
      `DELETE FROM examination_results
       WHERE student_id IN (SELECT id FROM students WHERE roll_number = ANY($1::varchar[]))`,
      [rolls]
    );
    await client.query(`DELETE FROM students WHERE roll_number = ANY($1::varchar[])`, [rolls]);
    await client.query(`DELETE FROM examinations WHERE test_name LIKE $1`, [`${EXAM_NAME_PREFIX}%`]);

    const studentIds = [];
    for (const st of STUDENTS) {
      const {
        rows: [row],
      } = await client.query(
        `INSERT INTO students (
          gender, first_name, last_name, roll_number, class_id, section_id,
          father_name, mother_name, guardian_phone, residence_type, date_of_birth,
          blood_group, address_location, address_city, address_district, address_state, address_pin,
          is_active, is_deleted, created_by, updated_by
        ) VALUES (
          $1, $2, $3, $4, $5::uuid, $6::uuid,
          $7, $8, $9, 'day_scholar', $10::date,
          $11, 'Near NH-48', $12, $13, 'Karnataka', $14,
          TRUE, FALSE, $15::uuid, $15::uuid
        ) RETURNING id, roll_number, first_name, last_name`,
        [
          st.gender,
          st.first,
          st.last,
          st.roll,
          classRow.id,
          section.id,
          st.father,
          st.mother,
          st.phone,
          st.dob,
          st.blood,
          st.city,
          st.district,
          st.pin,
          actorId,
        ]
      );
      studentIds.push({
        ...row,
        marksFa1: st.marksFa1,
        marksSa1: st.marksSa1,
        fee: st.fee,
      });
      console.log(`  Student ${row.roll_number}: ${row.first_name} ${row.last_name}`);
    }

    const perMax = subjectRows.map(() => 100);
    const perPass = subjectRows.map(() => 35);

    const fa1Exam = await insertExamWithSubjects(client, {
      testName: `${EXAM_NAME_PREFIX}Class 8 FA1 (Completed)`,
      examTypeId: fa1Type.id,
      classId: classRow.id,
      sectionId: section.id,
      examDate: isoOffsetDays(-45),
      status: 'completed',
      invigilator: 'Manjunath P',
      instructions: 'Ananya FA1 — use for progress / exam report PDF testing.',
      subjectRows,
      perMax,
      perPass,
      actorId,
    });
    await publishResults(client, fa1Exam.id, studentIds, subjectRows, 'marksFa1', actorId);

    const sa1Exam = await insertExamWithSubjects(client, {
      testName: `${EXAM_NAME_PREFIX}Class 8 SA1 (Completed)`,
      examTypeId: sa1Type.id,
      classId: classRow.id,
      sectionId: section.id,
      examDate: isoOffsetDays(-10),
      status: 'completed',
      invigilator: 'Manjunath P',
      instructions: 'Ananya SA1 — use for progress / exam report PDF testing.',
      subjectRows,
      perMax,
      perPass,
      actorId,
      startTime: '09:30',
      endTime: '12:30',
    });
    await publishResults(client, sa1Exam.id, studentIds, subjectRows, 'marksSa1', actorId);

    const fa2Exam = await insertExamWithSubjects(client, {
      testName: `${EXAM_NAME_PREFIX}Class 8 FA2 (Scheduled)`,
      examTypeId: fa2Type.id,
      classId: classRow.id,
      sectionId: section.id,
      examDate: isoOffsetDays(7),
      status: 'scheduled',
      invigilator: 'Manju',
      instructions: 'Ananya FA2 — scheduled for hall ticket PDF testing.',
      subjectRows,
      perMax,
      perPass,
      actorId,
      startTime: '10:00',
      endTime: '13:00',
    });

    const academicYear = '2025-26';
    let feeCount = 0;
    for (const st of studentIds) {
      if (!st.fee) continue;
      const { total, discount, paid } = st.fee;
      const {
        rows: [sf],
      } = await client.query(
        `INSERT INTO student_fees (
          student_id, academic_year, total_fee, discount, notes, due_date, created_by, updated_by
        ) VALUES (
          $1::uuid, $2, $3, $4, 'Seed fee for PDF testing', $5::date, $6::uuid, $6::uuid
        ) RETURNING id`,
        [st.id, academicYear, total, discount, isoOffsetDays(30), actorId]
      );

      const net = total - discount;
      const tuition = Math.round(net * 0.7);
      const transport = net - tuition;
      await client.query(
        `INSERT INTO student_fee_items (student_fee_id, fee_name, amount, discount, created_by)
         VALUES
           ($1::uuid, 'Tuition', $2, 0, $3::uuid),
           ($1::uuid, 'Transport', $4, 0, $3::uuid)`,
        [sf.id, tuition, actorId, transport]
      );

      if (paid > 0) {
        const firstPay = Math.min(paid, Math.round(paid * 0.6) || paid);
        await client.query(
          `INSERT INTO fee_payments (
            student_fee_id, amount, payment_date, payment_method, receipt_number, notes, created_by
          ) VALUES ($1::uuid, $2, $3::date, 'upi', $4, 'Seed payment 1', $5::uuid)`,
          [sf.id, firstPay, isoOffsetDays(-20), `APS-RCP-${st.roll_number}-1`, actorId]
        );
        const rest = paid - firstPay;
        if (rest > 0) {
          await client.query(
            `INSERT INTO fee_payments (
              student_fee_id, amount, payment_date, payment_method, receipt_number, notes, created_by
            ) VALUES ($1::uuid, $2, $3::date, 'cash', $4, 'Seed payment 2', $5::uuid)`,
            [sf.id, rest, isoOffsetDays(-5), `APS-RCP-${st.roll_number}-2`, actorId]
          );
        }
      }
      feeCount += 1;
    }

    await client.query('COMMIT');
    console.log('Done.');
    console.log({
      class: classRow.name,
      section: section.section_code,
      students: studentIds.length,
      subjects: subjectRows.map((s) => s.name),
      completedExams: [fa1Exam.test_name, sa1Exam.test_name],
      scheduledExam: fa2Exam.test_name,
      feesSeeded: feeCount,
      tip: 'Login → Student Report (progress/exam PDF), Examinations → hall tickets, Downloads (study/TC), Fees (statement/receipt).',
    });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error(e);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
