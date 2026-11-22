import fs from 'node:fs';
import { sendJson } from '../utils/apiResponse.js';
import { MESSAGES } from '../constants/messages.js';
import * as studentService from '../services/student.service.js';
import * as studentPhotoService from '../services/studentPhoto.service.js';
import { actorId } from '../utils/params.js';

function mapStudentError(err) {
  const msg = String(err?.message ?? '');
  if (!msg) return null;
  const lower = msg.toLowerCase();
  if (lower.includes('student not found')) return { statusCode: 404, message: MESSAGES.student.notFound };
  if (lower.includes('class not found')) return { statusCode: 404, message: MESSAGES.student.classNotFound };
  if (lower.includes('section not found')) return { statusCode: 404, message: MESSAGES.student.sectionNotFound };
  if (lower.includes('roll number already exists')) return { statusCode: 409, message: MESSAGES.student.rollNumberExists };
  if (lower.includes('cannot delete student')) return { statusCode: 409, message: MESSAGES.student.cannotDeleteWithRecords };
  if (lower.includes('required') || lower.includes('invalid') || lower.includes('does not belong')) return { statusCode: 400, message: msg };
  return null;
}

export async function getStudents(req, res) {
  try {
    const result = await studentService.getStudents({
      search: req.query?.search ?? null,
      classId: req.query?.classId ? String(req.query.classId).trim() : null,
      sectionId: req.query?.sectionId ? String(req.query.sectionId).trim() : null,
    });
    return sendJson(res, result.statusCode, { success: result.success, message: result.message, data: result.data });
  } catch (err) {
    console.error('getStudents', err);
    return sendJson(res, 500, { success: false, message: MESSAGES.common.internalServerError, data: null });
  }
}

export async function createStudent(req, res) {
  try {
    const userId = actorId(req);
    if (!userId) return sendJson(res, 401, { success: false, message: MESSAGES.common.unauthorized, data: null });
    const result = await studentService.createStudent(req.body, userId);
    return sendJson(res, result.statusCode, { success: result.success, message: result.message, data: result.data });
  } catch (err) {
    const mapped = mapStudentError(err);
    if (mapped) return sendJson(res, mapped.statusCode, { success: false, message: mapped.message, data: null });
    console.error('createStudent', err);
    return sendJson(res, 500, { success: false, message: MESSAGES.common.internalServerError, data: null });
  }
}

export async function getStudentById(req, res) {
  try {
    const result = await studentService.getStudentById(req.params.id);
    return sendJson(res, result.statusCode, { success: result.success, message: result.message, data: result.data });
  } catch (err) {
    const mapped = mapStudentError(err);
    if (mapped) return sendJson(res, mapped.statusCode, { success: false, message: mapped.message, data: null });
    console.error('getStudentById', err);
    return sendJson(res, 500, { success: false, message: MESSAGES.common.internalServerError, data: null });
  }
}

export async function updateStudent(req, res) {
  try {
    const userId = actorId(req);
    if (!userId) return sendJson(res, 401, { success: false, message: MESSAGES.common.unauthorized, data: null });
    const result = await studentService.updateStudent(req.params.id, req.body, userId);
    return sendJson(res, result.statusCode, { success: result.success, message: result.message, data: result.data });
  } catch (err) {
    const mapped = mapStudentError(err);
    if (mapped) return sendJson(res, mapped.statusCode, { success: false, message: mapped.message, data: null });
    console.error('updateStudent', err);
    return sendJson(res, 500, { success: false, message: MESSAGES.common.internalServerError, data: null });
  }
}

export async function deleteStudent(req, res) {
  try {
    const userId = actorId(req);
    if (!userId) return sendJson(res, 401, { success: false, message: MESSAGES.common.unauthorized, data: null });
    const result = await studentService.deleteStudent(req.params.id, userId);
    return sendJson(res, result.statusCode, { success: result.success, message: result.message, data: result.data });
  } catch (err) {
    const mapped = mapStudentError(err);
    if (mapped) return sendJson(res, mapped.statusCode, { success: false, message: mapped.message, data: null });
    console.error('deleteStudent', err);
    return sendJson(res, 500, { success: false, message: MESSAGES.common.internalServerError, data: null });
  }
}

export async function restoreStudent(req, res) {
  try {
    const userId = actorId(req);
    if (!userId) return sendJson(res, 401, { success: false, message: MESSAGES.common.unauthorized, data: null });
    const result = await studentService.restoreStudent(req.params.id, userId);
    return sendJson(res, result.statusCode, { success: result.success, message: result.message, data: result.data });
  } catch (err) {
    console.error('restoreStudent', err);
    return sendJson(res, 500, { success: false, message: MESSAGES.common.internalServerError, data: null });
  }
}

export async function toggleStudentStatus(req, res) {
  try {
    const userId = actorId(req);
    if (!userId) return sendJson(res, 401, { success: false, message: MESSAGES.common.unauthorized, data: null });
    const result = await studentService.toggleStudentStatus(req.params.id, userId);
    return sendJson(res, result.statusCode, { success: result.success, message: result.message, data: result.data });
  } catch (err) {
    console.error('toggleStudentStatus', err);
    return sendJson(res, 500, { success: false, message: MESSAGES.common.internalServerError, data: null });
  }
}

export async function uploadStudentPhoto(req, res) {
  try {
    const userId = actorId(req);
    if (!userId) return sendJson(res, 401, { success: false, message: MESSAGES.common.unauthorized, data: null });
    const result = await studentPhotoService.uploadStudentPhoto(req.params.id, req.file);
    return sendJson(res, result.statusCode, { success: result.success, message: result.message, data: result.data });
  } catch (err) {
    console.error('uploadStudentPhoto', err);
    return sendJson(res, 500, { success: false, message: MESSAGES.common.internalServerError, data: null });
  }
}

export async function getStudentPhoto(req, res) {
  try {
    const result = await studentPhotoService.resolveStudentPhotoFile(req.params.id);
    if (!result.success) {
      return sendJson(res, result.statusCode, { success: false, message: result.message, data: null });
    }
    res.setHeader('Content-Type', result.data.mime);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    return fs.createReadStream(result.data.absPath).pipe(res);
  } catch (err) {
    console.error('getStudentPhoto', err);
    return sendJson(res, 500, { success: false, message: MESSAGES.common.internalServerError, data: null });
  }
}

export async function deleteStudentPhoto(req, res) {
  try {
    const userId = actorId(req);
    if (!userId) return sendJson(res, 401, { success: false, message: MESSAGES.common.unauthorized, data: null });
    const result = await studentPhotoService.deleteStudentPhoto(req.params.id);
    return sendJson(res, result.statusCode, { success: result.success, message: result.message, data: result.data });
  } catch (err) {
    console.error('deleteStudentPhoto', err);
    return sendJson(res, 500, { success: false, message: MESSAGES.common.internalServerError, data: null });
  }
}
