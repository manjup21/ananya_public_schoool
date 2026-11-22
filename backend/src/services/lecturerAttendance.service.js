import { callProcedure, query } from '../db/db.js';
import { fromDbRow } from '../utils/apiResponse.js';
import { MESSAGES } from '../constants/messages.js';
import * as attendancePatternsService from './attendancePatterns.service.js';
import * as studentService from './student.service.js';
import { optStr, optUuid } from '../utils/params.js';

const SQL = {
  rosterAbsences: 'SELECT * FROM public.atr_list_absences_for_roster($1,$2,$3,$4)',
  bulkMark: 'SELECT * FROM public.atr_mark_students_absent_bulk($1,$2,$3,$4,$5,$6,$7)',
  bulkUnmark: 'SELECT * FROM public.atr_unmark_students_absent_bulk($1,$2,$3,$4,$5)',
  cancelSlot: 'SELECT * FROM public.atr_cancel_slot($1,$2,$3,$4,$5,$6)',
  uncancelSlot: 'SELECT * FROM public.atr_uncancel_slot($1,$2,$3,$4)',
  isSlotCancelled: 'SELECT * FROM public.atr_is_slot_cancelled($1,$2,$3,$4)',
};

function optDate(v) {
  const s = optStr(v);
  return s;
}

function isFutureDate(yyyyMmDd) {
  const s = optStr(yyyyMmDd);
  if (!s) return false;
  const d = new Date(`${s}T00:00:00`);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return d.getTime() > today.getTime();
}

async function institutionHolidayEnvelope(dateStr) {
  const rows = await query('SELECT public.atr_is_institution_holiday($1::date) AS is_holiday', [dateStr]);
  const isHoliday = rows?.[0]?.is_holiday === true;
  if (!isHoliday) return null;
  const nameRows = await query('SELECT public.atr_get_institution_holiday_names($1::date) AS names', [dateStr]);
  const names = nameRows?.[0]?.names != null ? String(nameRows[0].names) : '';
  const label = names.trim() ? names.trim() : 'Institution holiday';
  return {
    statusCode: 404,
    success: false,
    message: `Institution holiday: ${label}`,
    data: { is_institution_holiday: true, holiday_names: names.trim() || null },
  };
}

function optUuidArray(arr) {
  if (!Array.isArray(arr) || !arr.length) return null;
  const out = arr.map((x) => optUuid(x)).filter(Boolean);
  return out.length ? out : null;
}

export async function getAttendanceDayContext({ classId, sectionId, date }) {
  if (isFutureDate(date)) {
    return { statusCode: 400, success: false, message: MESSAGES.attendance.futureDateNotAllowed, data: null };
  }
  const dateStr = optDate(date);
  if (dateStr) {
    const hol = await institutionHolidayEnvelope(dateStr);
    if (hol) return hol;
  }
  return attendancePatternsService.resolveAttendancePattern({
    classId,
    date: dateStr,
    sectionId: sectionId ? optUuid(sectionId) : null,
  });
}

export async function getAttendanceRoster({ classId, sectionId, date, slotIndex, search }) {
  const classUuid = optUuid(classId);
  const dateStr = optDate(date);
  if (isFutureDate(dateStr)) {
    return { statusCode: 400, success: false, message: MESSAGES.attendance.futureDateNotAllowed, data: null };
  }
  const slot = Number(slotIndex);
  if (!classUuid || !dateStr || !Number.isFinite(slot) || slot < 1 || slot > 10) {
    return { statusCode: 400, success: false, message: 'classId, date, and slotIndex (1–10) are required', data: null };
  }

  const hol = await institutionHolidayEnvelope(dateStr);
  if (hol) return hol;

  const studentsRes = await studentService.getStudents({
    search: search ?? null,
    classId: classUuid,
    sectionId: sectionId ? optUuid(sectionId) : null,
  });
  if (!studentsRes.success) return studentsRes;

  const absRows = await callProcedure(SQL.rosterAbsences, [
    classUuid,
    sectionId ? optUuid(sectionId) : null,
    dateStr,
    Math.trunc(slot),
  ]);
  const absResult = fromDbRow(absRows?.[0]);
  if (!absResult.success) return absResult;

  const absentIds = new Set(
    (Array.isArray(absResult.data) ? absResult.data : []).map((r) => String(r.student_id ?? r.studentId ?? '')).filter(Boolean)
  );

  const students = studentsRes.data?.students ?? [];
  const roster = students.map((s) => ({
    ...s,
    is_absent: absentIds.has(String(s.id ?? s.student_id)),
  }));

  const cancelRows = await query(SQL.isSlotCancelled, [
    dateStr,
    Math.trunc(slot),
    classUuid,
    sectionId ? optUuid(sectionId) : null,
  ]);
  const cancelledRow = cancelRows?.[0];
  const isCancelled = cancelledRow?.is_cancelled === true;

  return {
    statusCode: 200,
    success: true,
    message: MESSAGES.attendance.rosterFetchedSuccess,
    data: {
      students: roster,
      is_slot_cancelled: isCancelled,
      cancelled_reason: isCancelled ? (cancelledRow.reason || null) : null,
    },
  };
}

export async function bulkMarkAbsent({ studentIds, absentDate, slotIndex, reason, actorUserId, classId, sectionId }) {
  const ids = optUuidArray(studentIds);
  if (!ids) {
    return { statusCode: 400, success: false, message: 'student_ids must be a non-empty array of UUIDs', data: null };
  }
  const absentDateStr = optDate(absentDate);
  if (absentDateStr) {
    const hol = await institutionHolidayEnvelope(absentDateStr);
    if (hol) return hol;
  }
  const rows = await callProcedure(SQL.bulkMark, [
    ids,
    absentDateStr,
    Math.trunc(Number(slotIndex)),
    reason ?? null,
    optUuid(actorUserId),
    optUuid(classId),
    sectionId ? optUuid(sectionId) : null,
  ]);
  return fromDbRow(rows?.[0]);
}

export async function bulkUnmarkAbsent({ studentIds, absentDate, slotIndex, classId, sectionId }) {
  const ids = optUuidArray(studentIds);
  if (!ids) {
    return { statusCode: 400, success: false, message: 'student_ids must be a non-empty array of UUIDs', data: null };
  }
  const absentDateStr = optDate(absentDate);
  if (absentDateStr) {
    const hol = await institutionHolidayEnvelope(absentDateStr);
    if (hol) return hol;
  }
  const rows = await callProcedure(SQL.bulkUnmark, [
    ids,
    absentDateStr,
    Math.trunc(Number(slotIndex)),
    optUuid(classId),
    sectionId ? optUuid(sectionId) : null,
  ]);
  return fromDbRow(rows?.[0]);
}

export async function cancelSlot({ date, slotIndex, classId, sectionId, reason, actorUserId }) {
  const dateStr = optDate(date);
  if (isFutureDate(dateStr)) {
    return { statusCode: 400, success: false, message: MESSAGES.attendance.futureDateNotAllowed, data: null };
  }
  if (dateStr) {
    const hol = await institutionHolidayEnvelope(dateStr);
    if (hol) return hol;
  }
  const rows = await callProcedure(SQL.cancelSlot, [
    dateStr,
    Math.trunc(Number(slotIndex)),
    optUuid(classId),
    sectionId ? optUuid(sectionId) : null,
    reason ?? null,
    optUuid(actorUserId),
  ]);
  return fromDbRow(rows?.[0]);
}

export async function uncancelSlot({ date, slotIndex, classId, sectionId }) {
  const dateStr = optDate(date);
  const rows = await callProcedure(SQL.uncancelSlot, [
    dateStr,
    Math.trunc(Number(slotIndex)),
    optUuid(classId),
    sectionId ? optUuid(sectionId) : null,
  ]);
  return fromDbRow(rows?.[0]);
}
