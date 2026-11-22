import { callProcedure } from '../db/db.js';
import { fromDbRow } from '../utils/apiResponse.js';
import * as studentService from './student.service.js';
import { optStr, optUuid, optIntTrimmed as optInt } from '../utils/params.js';

export const BULK_STUDENT_REPORT_MAX = 80;

const SQL = {
  attendanceSummary: 'SELECT * FROM public.atr_get_student_attendance_summary($1,$2,$3)',
  absences: 'SELECT * FROM public.atr_list_student_absences($1,$2,$3)',
  examSummary:
    'SELECT * FROM public.atr_get_student_performance_summary($1,$2,$3,$4,$5,$6,$7,$8)',
  progressReport:
    'SELECT * FROM public.atr_get_student_progress_report($1,$2,$3,$4)',
};

function optDate(v) {
  return optStr(v);
}

export async function listStudentsForLecturer({ search, classId, sectionId }) {
  // Reuse the existing student list logic (DB function validates class/section exist implicitly by returning 0 rows).
  return studentService.getStudents({ search: optStr(search), classId: optUuid(classId), sectionId: sectionId ? optUuid(sectionId) : null });
}

export async function getStudentByIdForLecturer(studentId) {
  return studentService.getStudentById(optUuid(studentId));
}

export async function getStudentAttendanceSummary({ studentId, from, to }) {
  const rows = await callProcedure(SQL.attendanceSummary, [optUuid(studentId), optDate(from), optDate(to)]);
  return fromDbRow(rows?.[0]);
}

export async function listStudentAbsences({ studentId, from, to }) {
  const rows = await callProcedure(SQL.absences, [optUuid(studentId), optDate(from), optDate(to)]);
  return fromDbRow(rows?.[0]);
}

export async function getStudentExamSummary({
  studentId,
  limit,
  offset,
  from,
  to,
  examTypeId,
  chartLimit,
  subjectId,
}) {
  const rows = await callProcedure(SQL.examSummary, [
    optUuid(studentId),
    optInt(limit) ?? 20,
    optInt(offset) ?? 0,
    optDate(from),
    optDate(to),
    optUuid(examTypeId),
    optInt(chartLimit) ?? 50,
    optUuid(subjectId),
  ]);
  return fromDbRow(rows?.[0]);
}

export async function getStudentProgressReport({ studentId, from, to, examTypeId }) {
  const rows = await callProcedure(SQL.progressReport, [
    optUuid(studentId),
    optDate(from),
    optDate(to),
    optUuid(examTypeId),
  ]);
  return fromDbRow(rows?.[0]);
}

/**
 * Fetch report data sequentially to avoid exhausting the shared DB pool.
 * A failure for one student does not prevent the remaining reports.
 */
export async function getBulkStudentProgressReports({ studentIds, from, to, examTypeId }) {
  const ids = Array.isArray(studentIds)
    ? [...new Set(studentIds.map((id) => optUuid(id)).filter(Boolean))]
    : [];

  if (!ids.length) {
    return {
      statusCode: 400,
      success: false,
      message: `studentIds is required (1–${BULK_STUDENT_REPORT_MAX} UUIDs)`,
      data: null,
    };
  }
  if (ids.length > BULK_STUDENT_REPORT_MAX) {
    return {
      statusCode: 400,
      success: false,
      message: `At most ${BULK_STUDENT_REPORT_MAX} students per bulk request`,
      data: null,
    };
  }

  const fromD = optDate(from);
  const toD = optDate(to);
  const typeId = optUuid(examTypeId);
  const reports = [];

  for (const studentId of ids) {
    try {
      const rows = await callProcedure(SQL.progressReport, [studentId, fromD, toD, typeId]);
      const result = fromDbRow(rows?.[0]);
      if (!result.success) {
        reports.push({
          studentId,
          sections: [],
          error: result.message || 'Failed to fetch progress report',
        });
        continue;
      }
      const sections = Array.isArray(result.data?.sections) ? result.data.sections : [];
      reports.push({
        studentId,
        sections,
        error: sections.length ? null : 'No completed exam results found',
      });
    } catch (err) {
      reports.push({
        studentId,
        sections: [],
        error: err?.message || 'Failed to fetch progress report',
      });
    }
  }

  return {
    statusCode: 200,
    success: true,
    message: 'Bulk progress reports fetched successfully',
    data: { reports },
  };
}

