import { callProcedure } from '../db/db.js';
import { fromDbRow } from '../utils/apiResponse.js';
import { optStr, optUuid } from '../utils/params.js';

const SQL = {
  save: 'SELECT * FROM public.atr_save_student_exam_result($1,$2,$3,$4,$5,$6,$7,$8,$9)',
  submit: 'SELECT * FROM public.atr_submit_student_exam_result($1,$2,$3)',
  publish: 'SELECT * FROM public.atr_publish_student_exam_result($1,$2,$3)',
  getOne: 'SELECT * FROM public.atr_get_student_exam_result($1,$2)',
  listForExam: 'SELECT * FROM public.atr_list_exam_results($1,$2,$3)',
  fullForExam: 'SELECT * FROM public.atr_get_exam_results_full($1,$2,$3)',
};

function optUuidArray(arr) {
  if (arr === undefined || arr === null) return null;
  if (!Array.isArray(arr)) return null;
  const cleaned = arr.map((x) => optUuid(x)).filter(Boolean);
  return cleaned.length ? cleaned : [];
}

function optIntArray(arr) {
  if (arr === undefined || arr === null) return null;
  if (!Array.isArray(arr)) return null;
  const out = [];
  for (const x of arr) {
    if (x === '' || x === undefined || x === null) {
      out.push(null);
      continue;
    }
    const n = Number(x);
    if (!Number.isFinite(n)) return null;
    out.push(Math.trunc(n));
  }
  return out;
}

function optBoolArray(arr) {
  if (arr === undefined || arr === null) return null;
  if (!Array.isArray(arr)) return null;
  return arr.map((x) => Boolean(x));
}

function optTextArray(arr) {
  if (arr === undefined || arr === null) return null;
  if (!Array.isArray(arr)) return null;
  return arr.map((x) => (x == null ? null : String(x)));
}

export async function saveStudentExamResult({
  examinationId,
  studentId,
  subjectIds,
  marks,
  isAbsent,
  remarks,
  partBSubjectIds,
  partBGrades,
  actorUserId,
}) {
  const rows = await callProcedure(SQL.save, [
    optUuid(examinationId),
    optUuid(studentId),
    optUuidArray(subjectIds) ?? [],
    optIntArray(marks),
    optBoolArray(isAbsent),
    optTextArray(remarks),
    optUuid(actorUserId),
    optUuidArray(partBSubjectIds) ?? [],
    optTextArray(partBGrades) ?? [],
  ]);
  return fromDbRow(rows?.[0]);
}

export async function submitStudentExamResult({ examinationId, studentId, actorUserId }) {
  const rows = await callProcedure(SQL.submit, [optUuid(examinationId), optUuid(studentId), optUuid(actorUserId)]);
  return fromDbRow(rows?.[0]);
}

export async function publishStudentExamResult({ examinationId, studentId, actorUserId }) {
  const rows = await callProcedure(SQL.publish, [optUuid(examinationId), optUuid(studentId), optUuid(actorUserId)]);
  return fromDbRow(rows?.[0]);
}

export async function getStudentExamResult({ examinationId, studentId }) {
  const rows = await callProcedure(SQL.getOne, [optUuid(examinationId), optUuid(studentId)]);
  return fromDbRow(rows?.[0]);
}

export async function listExamResults({ examinationId, search, status }) {
  const rows = await callProcedure(SQL.listForExam, [optUuid(examinationId), optStr(search), optStr(status)]);
  const result = fromDbRow(rows?.[0]);
  if (!result.success) return result;
  return { ...result, data: { results: Array.isArray(result.data) ? result.data : [] } };
}

export async function getExamResultsFull({ examinationId, search, status }) {
  const rows = await callProcedure(SQL.fullForExam, [optUuid(examinationId), optStr(search), optStr(status)]);
  return fromDbRow(rows?.[0]);
}
