import { sendJson } from '../utils/apiResponse.js';
import { MESSAGES } from '../constants/messages.js';
import * as lecturerStudentsService from '../services/lecturerStudents.service.js';

export async function listStudents(req, res) {
  try {
    const result = await lecturerStudentsService.listStudentsForLecturer({
      search: req.query.search ?? null,
      classId: req.query.classId,
      sectionId: req.query.sectionId ?? null,
    });
    return sendJson(res, result.statusCode, { success: result.success, message: result.message, data: result.data });
  } catch (err) {
    console.error('lecturer:listStudents', err);
    return sendJson(res, 500, { success: false, message: MESSAGES.common.internalServerError, data: null });
  }
}

export async function getStudentById(req, res) {
  try {
    const result = await lecturerStudentsService.getStudentByIdForLecturer(req.params.id);
    return sendJson(res, result.statusCode, { success: result.success, message: result.message, data: result.data });
  } catch (err) {
    console.error('lecturer:getStudentById', err);
    return sendJson(res, 500, { success: false, message: MESSAGES.common.internalServerError, data: null });
  }
}

export async function getAttendanceSummary(req, res) {
  try {
    const result = await lecturerStudentsService.getStudentAttendanceSummary({
      studentId: req.params.id,
      from: req.query.from,
      to: req.query.to,
    });
    return sendJson(res, result.statusCode, { success: result.success, message: result.message, data: result.data });
  } catch (err) {
    console.error('lecturer:getAttendanceSummary', err);
    return sendJson(res, 500, { success: false, message: MESSAGES.common.internalServerError, data: null });
  }
}

export async function listAbsences(req, res) {
  try {
    const result = await lecturerStudentsService.listStudentAbsences({
      studentId: req.params.id,
      from: req.query.from ?? null,
      to: req.query.to ?? null,
    });
    return sendJson(res, result.statusCode, { success: result.success, message: result.message, data: result.data });
  } catch (err) {
    console.error('lecturer:listAbsences', err);
    return sendJson(res, 500, { success: false, message: MESSAGES.common.internalServerError, data: null });
  }
}

export async function getExamSummary(req, res) {
  try {
    const result = await lecturerStudentsService.getStudentExamSummary({
      studentId: req.params.id,
      limit: req.query.limit,
      offset: req.query.offset,
      from: req.query.from,
      to: req.query.to,
      examTypeId: req.query.examTypeId,
      chartLimit: req.query.chartLimit,
      subjectId: req.query.subjectId,
    });
    return sendJson(res, result.statusCode, { success: result.success, message: result.message, data: result.data });
  } catch (err) {
    console.error('lecturer:getExamSummary', err);
    return sendJson(res, 500, { success: false, message: MESSAGES.common.internalServerError, data: null });
  }
}

export async function getProgressReport(req, res) {
  try {
    const result = await lecturerStudentsService.getStudentProgressReport({
      studentId: req.params.id,
      from: req.query.from,
      to: req.query.to,
      examTypeId: req.query.examTypeId,
    });
    return sendJson(res, result.statusCode, { success: result.success, message: result.message, data: result.data });
  } catch (err) {
    console.error('lecturer:getProgressReport', err);
    return sendJson(res, 500, { success: false, message: MESSAGES.common.internalServerError, data: null });
  }
}

export async function getBulkProgressReports(req, res) {
  try {
    const result = await lecturerStudentsService.getBulkStudentProgressReports({
      studentIds: req.body?.studentIds,
      from: req.body?.from,
      to: req.body?.to,
      examTypeId: req.body?.examTypeId,
    });
    return sendJson(res, result.statusCode, {
      success: result.success,
      message: result.message,
      data: result.data,
    });
  } catch (err) {
    console.error('lecturer:getBulkProgressReports', err);
    return sendJson(res, 500, {
      success: false,
      message: MESSAGES.common.internalServerError,
      data: null,
    });
  }
}

