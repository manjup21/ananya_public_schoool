import { callProcedure, pool } from '../db/db.js';
import { fromDbRow } from '../utils/apiResponse.js';
import { MESSAGES } from '../constants/messages.js';
import * as studentService from './student.service.js';
import { absolutePhotoPath } from './studentPhoto.service.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import { optStr, optUuid, optInt } from '../utils/params.js';

const SQL = {
  list: 'SELECT * FROM public.atr_get_examinations($1,$2,$3,$4,$5)',
  create:
    'SELECT * FROM public.atr_create_examination($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)',
  getById: 'SELECT * FROM public.atr_get_examination_by_id($1)',
  update:
    'SELECT * FROM public.atr_update_examination($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)',
  cancel: 'SELECT * FROM public.atr_cancel_examination($1,$2)',
};

const PHOTO_READ_CONCURRENCY = 8;

const BULK_HALL_TICKET_MAX = 120;

const MIME_BY_EXT = Object.freeze({
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
});

/** Run async work over items with a fixed concurrency limit. */
async function mapPool(items, concurrency, fn) {
  const list = Array.isArray(items) ? items : [];
  const limit = Math.max(1, Math.min(concurrency, list.length || 1));
  const out = new Array(list.length);
  let next = 0;
  async function worker() {
    while (next < list.length) {
      const i = next;
      next += 1;
      out[i] = await fn(list[i], i);
    }
  }
  await Promise.all(Array.from({ length: limit }, () => worker()));
  return out;
}

/**
 * Read passport photos for roster students in one pass (avoids N HTTP photo calls).
 * Returns { [studentId]: dataUrl }.
 */
async function loadHallTicketPhotos(students) {
  const withPhoto = (students ?? []).filter((s) => s?.id && s?.photo_path);
  if (!withPhoto.length) return {};

  const entries = await mapPool(withPhoto, PHOTO_READ_CONCURRENCY, async (s) => {
    const abs = absolutePhotoPath(s.photo_path);
    if (!abs) return null;
    try {
      const buf = await fs.readFile(abs);
      if (!buf?.length) return null;
      const ext = path.extname(abs).toLowerCase();
      const mime = MIME_BY_EXT[ext] || 'image/jpeg';
      return [String(s.id), `data:${mime};base64,${buf.toString('base64')}`];
    } catch {
      return null;
    }
  });

  const photos = {};
  for (const entry of entries) {
    if (entry) photos[entry[0]] = entry[1];
  }
  return photos;
}

function optUuidArray(arr) {
  if (arr === undefined || arr === null) return null;
  if (!Array.isArray(arr)) return null;
  const cleaned = arr.map((x) => optUuid(x)).filter(Boolean);
  return cleaned.length ? cleaned : [];
}

/** Parallel to subject_ids; null = let DB replicate single max/pass per subject. */
function optIntArray(arr) {
  if (arr === undefined || arr === null) return null;
  if (!Array.isArray(arr)) return null;
  const out = [];
  for (const x of arr) {
    const n = optInt(x);
    if (n === null || !Number.isFinite(n)) return null;
    out.push(n);
  }
  return out.length ? out : null;
}

/** Same length as subject_ids; empty entries stay null (passing marks optional). */
function optNullableIntArray(arr) {
  if (arr === undefined || arr === null) return null;
  if (!Array.isArray(arr)) return null;
  return arr.map((x) => optInt(x));
}

/** Parallel date strings YYYY-MM-DD; null if omitted. */
function optDateArray(arr) {
  if (arr === undefined || arr === null) return null;
  if (!Array.isArray(arr)) return null;
  return arr.map((x) => {
    if (x === undefined || x === null || String(x).trim() === '') return null;
    return String(x).trim();
  });
}

/** Parallel time strings HH:MM[:SS]; empty → null. */
function optNullableTimeArray(arr) {
  if (arr === undefined || arr === null) return null;
  if (!Array.isArray(arr)) return null;
  return arr.map((x) => {
    if (x === undefined || x === null || String(x).trim() === '') return null;
    return String(x).trim();
  });
}

export async function getExaminations({ search, classId, sectionId, status, examTypeId }) {
  const rows = await callProcedure(SQL.list, [
    optStr(search),
    optUuid(classId),
    optUuid(sectionId),
    optStr(status),
    optUuid(examTypeId),
  ]);
  const result = fromDbRow(rows?.[0]);
  if (!result.success) return result;
  return { ...result, data: { examinations: Array.isArray(result.data) ? result.data : [] } };
}

export async function createExamination(payload, actorUserId) {
  const rows = await callProcedure(SQL.create, [
    optStr(payload.test_name),
    optUuid(payload.exam_type_id),
    optStr(payload.exam_status),
    optUuid(payload.class_id),
    optUuid(payload.section_id),
    optUuidArray(payload.section_ids),
    optUuidArray(payload.subject_ids),
    payload.exam_date ?? null,
    payload.start_time ?? null,
    payload.end_time ?? null,
    optInt(payload.max_marks),
    optInt(payload.passing_marks),
    optStr(payload.invigilator),
    optStr(payload.instructions),
    optIntArray(payload.subject_max_marks),
    optNullableIntArray(payload.subject_passing_marks),
    optUuid(actorUserId),
    optDateArray(payload.subject_exam_dates),
    optNullableTimeArray(payload.subject_start_times),
    optNullableTimeArray(payload.subject_end_times),
    optUuidArray(payload.part_b_subject_ids ?? []),
  ]);
  return fromDbRow(rows?.[0]);
}

export async function getExaminationById(examId) {
  const rows = await callProcedure(SQL.getById, [optUuid(examId)]);
  return fromDbRow(rows?.[0]);
}

function sortByRollNumber(a, b) {
  return String(a.roll_number ?? '').localeCompare(String(b.roll_number ?? ''), undefined, { numeric: true });
}

/**
 * Exam row + students in scope (class/section) for offline marks Excel template.
 */
export async function getExamMarksTemplate(examId) {
  const examResult = await getExaminationById(examId);
  if (!examResult.success) return examResult;

  const exam = examResult.data;
  if (!exam || typeof exam !== 'object') {
    return { statusCode: 404, success: false, message: MESSAGES.examination.notFound, data: null };
  }

  const sectionId =
    exam.section_id != null && String(exam.section_id).trim() !== '' ? String(exam.section_id).trim() : null;
  const sectionIds =
    Array.isArray(exam.section_ids) && exam.section_ids.length
      ? exam.section_ids.map((x) => String(x)).filter((x) => x.trim() !== '')
      : [];

  const studentsResult = await studentService.getStudents({
    search: null,
    classId: exam.class_id,
    sectionId: sectionId, // null => full class roster
  });
  if (!studentsResult.success) return studentsResult;

  const raw = studentsResult.data?.students ?? [];
  const scoped = sectionIds.length
    ? raw.filter((s) => sectionIds.includes(String(s.section_id)))
    : raw;
  const active = scoped.filter((s) => s.is_active !== false);
  const sorted = [...active].sort(sortByRollNumber);
  const studentRows = sorted.map((s) => ({
    id: s.id,
    roll_number: s.roll_number,
    student_name: [s.first_name, s.last_name].filter(Boolean).join(' ').trim(),
  }));

  const subjects = Array.isArray(exam.subjects)
    ? exam.subjects.map((sub) => ({
        id: sub.id,
        name: sub.name,
        is_part_b: Boolean(sub.is_part_b),
        max_marks: sub.max_marks ?? null,
        passing_marks: sub.passing_marks ?? null,
      }))
    : [];

  return {
    statusCode: 200,
    success: true,
    message: MESSAGES.examination.templateFetchedSuccess,
    data: {
      exam: {
        id: exam.id,
        test_name: exam.test_name,
        exam_type: exam.exam_type_name ?? null,
        exam_type_id: exam.exam_type_id ?? null,
        exam_date: exam.exam_date,
        start_time: exam.start_time ?? null,
        end_time: exam.end_time ?? null,
        exam_status: exam.exam_status ?? null,
        class_id: exam.class_id,
        section_id: exam.section_id,
        section_ids: Array.isArray(exam.section_ids) ? exam.section_ids : [],
        subjects,
      },
      students: studentRows,
    },
  };
}

/**
 * Roster + subject schedule for bulk hall-ticket ZIP (max 120 students).
 */
export async function getHallTicketRoster(examId) {
  const examResult = await getExaminationById(examId);
  if (!examResult.success) return examResult;

  const exam = examResult.data;
  if (!exam || typeof exam !== 'object') {
    return { statusCode: 404, success: false, message: MESSAGES.examination.notFound, data: null };
  }

  if (String(exam.exam_status ?? '').toLowerCase() !== 'scheduled') {
    return {
      statusCode: 400,
      success: false,
      message: MESSAGES.examination.hallTicketOnlyScheduled,
      data: { exam_status: exam.exam_status ?? null },
    };
  }

  const sectionId =
    exam.section_id != null && String(exam.section_id).trim() !== '' ? String(exam.section_id).trim() : null;
  const sectionIds =
    Array.isArray(exam.section_ids) && exam.section_ids.length
      ? exam.section_ids.map((x) => String(x)).filter((x) => x.trim() !== '')
      : [];

  const params = [exam.class_id];
  let sectionClause = '';
  if (sectionId) {
    params.push(sectionId);
    sectionClause = ` AND s.section_id = $${params.length}::uuid`;
  } else if (sectionIds.length) {
    params.push(sectionIds);
    sectionClause = ` AND s.section_id = ANY($${params.length}::uuid[])`;
  }

  const { rows } = await pool.query(
    `SELECT
       s.id,
       s.roll_number,
       s.first_name,
       s.last_name,
       s.date_of_birth,
       s.gender,
       s.father_name,
       s.mother_name,
       s.photo_path,
       s.class_id,
       s.section_id
     FROM students s
     WHERE s.is_deleted = FALSE
       AND s.is_active = TRUE
       AND s.class_id = $1::uuid
       ${sectionClause}
     ORDER BY s.roll_number ASC, s.first_name ASC`,
    params
  );

  const sorted = [...(rows ?? [])].sort(sortByRollNumber);

  if (sorted.length > BULK_HALL_TICKET_MAX) {
    return {
      statusCode: 400,
      success: false,
      message: MESSAGES.examination.hallTicketTooMany,
      data: { count: sorted.length, max: BULK_HALL_TICKET_MAX },
    };
  }

  // Part B is grade-only — never print on hall tickets
  const subjects = Array.isArray(exam.subjects)
    ? exam.subjects
        .filter((sub) => !sub?.is_part_b)
        .map((sub) => ({
          id: sub.id,
          name: sub.name,
          code: sub.code ?? null,
          exam_date: sub.exam_date ?? null,
          start_time: sub.start_time ?? null,
          end_time: sub.end_time ?? null,
        }))
    : [];

  // One disk pass for photos — client no longer calls GET /students/:id/photo per student
  const photos = await loadHallTicketPhotos(sorted);

  return {
    statusCode: 200,
    success: true,
    message: MESSAGES.examination.hallTicketRosterFetched,
    data: {
      exam: {
        id: exam.id,
        test_name: exam.test_name,
        exam_type_name: exam.exam_type_name ?? null,
        exam_date: exam.exam_date,
        class_id: exam.class_id,
        section_id: exam.section_id,
        section_ids: Array.isArray(exam.section_ids) ? exam.section_ids : [],
        subjects,
      },
      students: sorted.map((s) => ({
        id: s.id,
        roll_number: s.roll_number,
        first_name: s.first_name,
        last_name: s.last_name,
        date_of_birth: s.date_of_birth,
        gender: s.gender,
        father_name: s.father_name,
        mother_name: s.mother_name,
        photo_path: s.photo_path,
        class_id: s.class_id,
        section_id: s.section_id,
      })),
      photos,
    },
  };
}

export async function updateExamination(examId, payload, actorUserId) {
  const rows = await callProcedure(SQL.update, [
    optUuid(examId),
    optStr(payload.test_name),
    payload.exam_type_id === undefined ? null : optUuid(payload.exam_type_id),
    optStr(payload.exam_status),
    optUuid(payload.class_id),
    optUuid(payload.section_id),
    payload.section_ids === undefined ? null : optUuidArray(payload.section_ids),
    optUuidArray(payload.subject_ids),
    payload.exam_date ?? null,
    payload.start_time ?? null,
    payload.end_time ?? null,
    payload.max_marks === undefined ? null : optInt(payload.max_marks),
    payload.passing_marks === undefined ? null : optInt(payload.passing_marks),
    optStr(payload.invigilator),
    payload.instructions === undefined ? null : optStr(payload.instructions),
    optIntArray(payload.subject_max_marks),
    optNullableIntArray(payload.subject_passing_marks),
    optUuid(actorUserId),
    optDateArray(payload.subject_exam_dates),
    optNullableTimeArray(payload.subject_start_times),
    optNullableTimeArray(payload.subject_end_times),
    payload.part_b_subject_ids === undefined ? null : optUuidArray(payload.part_b_subject_ids),
  ]);
  return fromDbRow(rows?.[0]);
}

export async function cancelExamination(examId, actorUserId) {
  const rows = await callProcedure(SQL.cancel, [optUuid(examId), optUuid(actorUserId)]);
  return fromDbRow(rows?.[0]);
}

