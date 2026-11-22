import { sendJson } from '../utils/apiResponse.js';
import { MESSAGES } from '../constants/messages.js';
import * as examResultsService from '../services/examResults.service.js';
import * as examinationService from '../services/examination.service.js';
import * as studentService from '../services/student.service.js';
import { actorId } from '../utils/params.js';

function mapError(err) {
  const msg = String(err?.message ?? '');
  if (!msg) return null;
  const lower = msg.toLowerCase();
  if (lower.includes('not found')) return { statusCode: 404, message: msg };
  if (lower.includes('locked') || lower.includes('must be submitted') || lower.includes('already')) return { statusCode: 409, message: msg };
  if (lower.includes('required') || lower.includes('must') || lower.includes('invalid') || lower.includes('does not belong')) {
    return { statusCode: 400, message: msg };
  }
  return null;
}

export async function getStudentResult(req, res) {
  try {
    const result = await examResultsService.getStudentExamResult({
      examinationId: req.params.id,
      studentId: req.params.studentId,
    });
    return sendJson(res, result.statusCode, { success: result.success, message: result.message, data: result.data });
  } catch (err) {
    const mapped = mapError(err);
    if (mapped) return sendJson(res, mapped.statusCode, { success: false, message: mapped.message, data: null });
    console.error('getStudentResult', err);
    return sendJson(res, 500, { success: false, message: MESSAGES.common.internalServerError, data: null });
  }
}

export async function listResults(req, res) {
  try {
    const result = await examResultsService.listExamResults({
      examinationId: req.params.id,
      search: req.query?.search ?? null,
      status: req.query?.status ?? null,
    });
    return sendJson(res, result.statusCode, { success: result.success, message: result.message, data: result.data });
  } catch (err) {
    const mapped = mapError(err);
    if (mapped) return sendJson(res, mapped.statusCode, { success: false, message: mapped.message, data: null });
    console.error('listResults', err);
    return sendJson(res, 500, { success: false, message: MESSAGES.common.internalServerError, data: null });
  }
}

export async function listResultsFull(req, res) {
  try {
    const result = await examResultsService.getExamResultsFull({
      examinationId: req.params.id,
      search: req.query?.search ?? null,
      status: req.query?.status ?? null,
    });
    return sendJson(res, result.statusCode, { success: result.success, message: result.message, data: result.data });
  } catch (err) {
    const mapped = mapError(err);
    if (mapped) return sendJson(res, mapped.statusCode, { success: false, message: mapped.message, data: null });
    console.error('listResultsFull', err);
    return sendJson(res, 500, { success: false, message: MESSAGES.common.internalServerError, data: null });
  }
}

export async function saveStudentResult(req, res) {
  try {
    const userId = actorId(req);
    if (!userId) return sendJson(res, 401, { success: false, message: MESSAGES.common.unauthorized, data: null });
    const b = req.body ?? {};
    const result = await examResultsService.saveStudentExamResult({
      examinationId: req.params.id,
      studentId: b.student_id,
      subjectIds: b.subject_ids,
      marks: b.marks,
      isAbsent: b.is_absent,
      remarks: b.remarks,
      partBSubjectIds: b.part_b_subject_ids,
      partBGrades: b.part_b_grades,
      actorUserId: userId,
    });
    return sendJson(res, result.statusCode, { success: result.success, message: result.message, data: result.data });
  } catch (err) {
    const mapped = mapError(err);
    if (mapped) return sendJson(res, mapped.statusCode, { success: false, message: mapped.message, data: null });
    console.error('saveStudentResult', err);
    return sendJson(res, 500, { success: false, message: MESSAGES.common.internalServerError, data: null });
  }
}

// Bulk save: loops per student (fine for ~60 students)
export async function bulkSaveResults(req, res) {
  try {
    const userId = actorId(req);
    if (!userId) return sendJson(res, 401, { success: false, message: MESSAGES.common.unauthorized, data: null });
    const b = req.body ?? {};
    const rows = Array.isArray(b.rows) ? b.rows : [];
    if (!rows.length) return sendJson(res, 400, { success: false, message: 'rows is required', data: null });

    const out = [];
    for (const r of rows) {
      const one = await examResultsService.saveStudentExamResult({
        examinationId: req.params.id,
        studentId: r.student_id,
        subjectIds: r.subject_ids,
        marks: r.marks,
        isAbsent: r.is_absent,
        remarks: r.remarks,
        partBSubjectIds: r.part_b_subject_ids,
        partBGrades: r.part_b_grades,
        actorUserId: userId,
      });
      if (!one.success) {
        return sendJson(res, one.statusCode, { success: false, message: one.message, data: { failed_student_id: r.student_id } });
      }
      out.push({ student_id: r.student_id, result_id: one.data?.result_id ?? one.data?.id ?? null });
    }

    return sendJson(res, 200, { success: true, message: MESSAGES.examResults.savedSuccess, data: { saved: out } });
  } catch (err) {
    const mapped = mapError(err);
    if (mapped) return sendJson(res, mapped.statusCode, { success: false, message: mapped.message, data: null });
    console.error('bulkSaveResults', err);
    return sendJson(res, 500, { success: false, message: MESSAGES.common.internalServerError, data: null });
  }
}

export async function submitAllForExam(req, res) {
  try {
    const userId = actorId(req);
    if (!userId) return sendJson(res, 401, { success: false, message: MESSAGES.common.unauthorized, data: null });

    // Template provides roll_number/student_name only; fetch student ids for the exam scope.
    const examResult = await examinationService.getExaminationById(req.params.id);
    if (!examResult.success) return sendJson(res, examResult.statusCode, { success: false, message: examResult.message, data: null });
    const exam = examResult.data;
    const sec =
      exam.section_id != null && String(exam.section_id).trim() !== '' ? String(exam.section_id).trim() : null;
    const studentsResult = await studentService.getStudents({ search: null, classId: exam.class_id, sectionId: sec });
    if (!studentsResult.success) return sendJson(res, studentsResult.statusCode, { success: false, message: studentsResult.message, data: null });
    const students = studentsResult.data?.students ?? [];
    const saved = [];
    for (const s of students) {
      const r = await examResultsService.submitStudentExamResult({
        examinationId: req.params.id,
        studentId: s.id,
        actorUserId: userId,
      });
      if (!r.success && r.statusCode !== 404) {
        return sendJson(res, r.statusCode, { success: false, message: r.message, data: { failed_student_id: s.id ?? s.student_id } });
      }
      if (r.success) saved.push({ student_id: s.id ?? s.student_id, result_id: r.data?.result_id ?? null });
    }
    return sendJson(res, 200, { success: true, message: MESSAGES.examResults.submittedSuccess, data: { submitted: saved } });
  } catch (err) {
    const mapped = mapError(err);
    if (mapped) return sendJson(res, mapped.statusCode, { success: false, message: mapped.message, data: null });
    console.error('submitAllForExam', err);
    return sendJson(res, 500, { success: false, message: MESSAGES.common.internalServerError, data: null });
  }
}

export async function publishAllForExam(req, res) {
  try {
    const userId = actorId(req);
    if (!userId) return sendJson(res, 401, { success: false, message: MESSAGES.common.unauthorized, data: null });

    const examResult = await examinationService.getExaminationById(req.params.id);
    if (!examResult.success) return sendJson(res, examResult.statusCode, { success: false, message: examResult.message, data: null });
    const exam = examResult.data;
    const sec =
      exam.section_id != null && String(exam.section_id).trim() !== '' ? String(exam.section_id).trim() : null;
    const studentsResult = await studentService.getStudents({ search: null, classId: exam.class_id, sectionId: sec });
    if (!studentsResult.success) return sendJson(res, studentsResult.statusCode, { success: false, message: studentsResult.message, data: null });
    const students = studentsResult.data?.students ?? [];
    const saved = [];
    for (const s of students) {
      const r = await examResultsService.publishStudentExamResult({
        examinationId: req.params.id,
        studentId: s.id,
        actorUserId: userId,
      });
      if (!r.success && r.statusCode !== 404) {
        return sendJson(res, r.statusCode, { success: false, message: r.message, data: { failed_student_id: s.id ?? s.student_id } });
      }
      if (r.success) saved.push({ student_id: s.id ?? s.student_id, result_id: r.data?.result_id ?? null });
    }
    return sendJson(res, 200, { success: true, message: MESSAGES.examResults.publishedSuccess, data: { published: saved } });
  } catch (err) {
    const mapped = mapError(err);
    if (mapped) return sendJson(res, mapped.statusCode, { success: false, message: mapped.message, data: null });
    console.error('publishAllForExam', err);
    return sendJson(res, 500, { success: false, message: MESSAGES.common.internalServerError, data: null });
  }
}

