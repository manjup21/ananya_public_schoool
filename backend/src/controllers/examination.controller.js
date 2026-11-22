import { sendJson } from '../utils/apiResponse.js';
import { MESSAGES } from '../constants/messages.js';
import * as examinationService from '../services/examination.service.js';
import { actorId } from '../utils/params.js';

function mapExamError(err) {
  const msg = String(err?.message ?? '');
  if (!msg) return null;
  const lower = msg.toLowerCase();
  if (lower.includes('examination not found')) return { statusCode: 404, message: MESSAGES.examination.notFound };
  if (lower.includes('class not found')) return { statusCode: 404, message: MESSAGES.examination.classNotFound };
  if (lower.includes('section not found')) return { statusCode: 404, message: MESSAGES.examination.sectionNotFound };
  if (lower.includes('already exists')) return { statusCode: 409, message: msg };
  if (lower.includes('exam type')) return { statusCode: 400, message: msg };
  if (lower.includes('subject')) return { statusCode: 400, message: msg };
  if (lower.includes('required') || lower.includes('invalid') || lower.includes('does not belong')) return { statusCode: 400, message: msg };
  return null;
}

export async function getExaminations(req, res) {
  try {
    const rawExamTypeId = req.query?.examTypeId ? String(req.query.examTypeId).trim() : null;
    const result = await examinationService.getExaminations({
      search: req.query?.search ?? null,
      classId: req.query?.classId ? String(req.query.classId).trim() : null,
      sectionId: req.query?.sectionId ? String(req.query.sectionId).trim() : null,
      status: req.query?.status ? String(req.query.status).trim() : null,
      examTypeId: rawExamTypeId && rawExamTypeId !== 'all' ? rawExamTypeId : null,
    });
    return sendJson(res, result.statusCode, { success: result.success, message: result.message, data: result.data });
  } catch (err) {
    console.error('getExaminations', err);
    return sendJson(res, 500, { success: false, message: MESSAGES.common.internalServerError, data: null });
  }
}

export async function createExamination(req, res) {
  try {
    const userId = actorId(req);
    if (!userId) return sendJson(res, 401, { success: false, message: MESSAGES.common.unauthorized, data: null });
    const result = await examinationService.createExamination(req.body, userId);
    return sendJson(res, result.statusCode, { success: result.success, message: result.message, data: result.data });
  } catch (err) {
    const mapped = mapExamError(err);
    if (mapped) return sendJson(res, mapped.statusCode, { success: false, message: mapped.message, data: null });
    console.error('createExamination', err);
    return sendJson(res, 500, { success: false, message: MESSAGES.common.internalServerError, data: null });
  }
}

export async function getExaminationById(req, res) {
  try {
    const result = await examinationService.getExaminationById(req.params.id);
    return sendJson(res, result.statusCode, { success: result.success, message: result.message, data: result.data });
  } catch (err) {
    const mapped = mapExamError(err);
    if (mapped) return sendJson(res, mapped.statusCode, { success: false, message: mapped.message, data: null });
    console.error('getExaminationById', err);
    return sendJson(res, 500, { success: false, message: MESSAGES.common.internalServerError, data: null });
  }
}

export async function getExamMarksTemplate(req, res) {
  try {
    const result = await examinationService.getExamMarksTemplate(req.params.id);
    return sendJson(res, result.statusCode, { success: result.success, message: result.message, data: result.data });
  } catch (err) {
    const mapped = mapExamError(err);
    if (mapped) return sendJson(res, mapped.statusCode, { success: false, message: mapped.message, data: null });
    console.error('getExamMarksTemplate', err);
    return sendJson(res, 500, { success: false, message: MESSAGES.common.internalServerError, data: null });
  }
}

export async function getHallTicketRoster(req, res) {
  try {
    const result = await examinationService.getHallTicketRoster(req.params.id);
    return sendJson(res, result.statusCode, { success: result.success, message: result.message, data: result.data });
  } catch (err) {
    const mapped = mapExamError(err);
    if (mapped) return sendJson(res, mapped.statusCode, { success: false, message: mapped.message, data: null });
    console.error('getHallTicketRoster', err);
    return sendJson(res, 500, { success: false, message: MESSAGES.common.internalServerError, data: null });
  }
}

export async function updateExamination(req, res) {
  try {
    const userId = actorId(req);
    if (!userId) return sendJson(res, 401, { success: false, message: MESSAGES.common.unauthorized, data: null });
    const result = await examinationService.updateExamination(req.params.id, req.body, userId);
    return sendJson(res, result.statusCode, { success: result.success, message: result.message, data: result.data });
  } catch (err) {
    const mapped = mapExamError(err);
    if (mapped) return sendJson(res, mapped.statusCode, { success: false, message: mapped.message, data: null });
    console.error('updateExamination', err);
    return sendJson(res, 500, { success: false, message: MESSAGES.common.internalServerError, data: null });
  }
}

export async function cancelExamination(req, res) {
  try {
    const userId = actorId(req);
    if (!userId) return sendJson(res, 401, { success: false, message: MESSAGES.common.unauthorized, data: null });
    const result = await examinationService.cancelExamination(req.params.id, userId);
    return sendJson(res, result.statusCode, { success: result.success, message: result.message, data: result.data });
  } catch (err) {
    const mapped = mapExamError(err);
    if (mapped) return sendJson(res, mapped.statusCode, { success: false, message: mapped.message, data: null });
    console.error('cancelExamination', err);
    return sendJson(res, 500, { success: false, message: MESSAGES.common.internalServerError, data: null });
  }
}

