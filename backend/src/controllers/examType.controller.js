import { sendJson } from '../utils/apiResponse.js';
import { MESSAGES } from '../constants/messages.js';
import * as examTypeService from '../services/examType.service.js';
import { actorId } from '../utils/params.js';

function mapExamTypeError(err) {
  const msg = String(err?.message ?? '');
  if (!msg) return null;
  const lower = msg.toLowerCase();
  if (lower.includes('already exists')) return { statusCode: 409, message: msg };
  if (lower.includes('in use')) return { statusCode: 409, message: msg };
  if (lower.includes('cannot delete system') || lower.includes('cannot modify system')) {
    return { statusCode: 400, message: msg };
  }
  if (lower.includes('not found')) return { statusCode: 404, message: msg };
  if (lower.includes('required')) return { statusCode: 400, message: msg };
  return null;
}

export async function getExamTypes(req, res) {
  try {
    const result = await examTypeService.getExamTypes(req.query?.search ?? null);
    return sendJson(res, result.statusCode, { success: result.success, message: result.message, data: result.data });
  } catch (err) {
    console.error('getExamTypes', err);
    return sendJson(res, 500, { success: false, message: MESSAGES.common.internalServerError, data: null });
  }
}

export async function createExamType(req, res) {
  try {
    const userId = actorId(req);
    if (!userId) return sendJson(res, 401, { success: false, message: MESSAGES.common.unauthorized, data: null });
    const result = await examTypeService.createExamType(req.body, userId);
    return sendJson(res, result.statusCode, { success: result.success, message: result.message, data: result.data });
  } catch (err) {
    const mapped = mapExamTypeError(err);
    if (mapped) return sendJson(res, mapped.statusCode, { success: false, message: mapped.message, data: null });
    console.error('createExamType', err);
    return sendJson(res, 500, { success: false, message: MESSAGES.common.internalServerError, data: null });
  }
}

export async function updateExamType(req, res) {
  try {
    const userId = actorId(req);
    if (!userId) return sendJson(res, 401, { success: false, message: MESSAGES.common.unauthorized, data: null });
    const result = await examTypeService.updateExamType(req.params.id, req.body, userId);
    return sendJson(res, result.statusCode, { success: result.success, message: result.message, data: result.data });
  } catch (err) {
    const mapped = mapExamTypeError(err);
    if (mapped) return sendJson(res, mapped.statusCode, { success: false, message: mapped.message, data: null });
    console.error('updateExamType', err);
    return sendJson(res, 500, { success: false, message: MESSAGES.common.internalServerError, data: null });
  }
}

export async function deleteExamType(req, res) {
  try {
    const result = await examTypeService.deleteExamType(req.params.id);
    return sendJson(res, result.statusCode, { success: result.success, message: result.message, data: result.data });
  } catch (err) {
    const mapped = mapExamTypeError(err);
    if (mapped) return sendJson(res, mapped.statusCode, { success: false, message: mapped.message, data: null });
    console.error('deleteExamType', err);
    return sendJson(res, 500, { success: false, message: MESSAGES.common.internalServerError, data: null });
  }
}

export async function reorderExamTypes(req, res) {
  try {
    const userId = actorId(req);
    if (!userId) return sendJson(res, 401, { success: false, message: MESSAGES.common.unauthorized, data: null });
    const result = await examTypeService.reorderExamTypes(req.body.ordered_ids);
    return sendJson(res, result.statusCode, { success: result.success, message: result.message, data: result.data });
  } catch (err) {
    const mapped = mapExamTypeError(err);
    if (mapped) return sendJson(res, mapped.statusCode, { success: false, message: mapped.message, data: null });
    const msg = String(err?.message ?? '');
    if (msg.toLowerCase().includes('ordered_ids') || msg.toLowerCase().includes('system exam type')) {
      return sendJson(res, 400, { success: false, message: msg, data: null });
    }
    console.error('reorderExamTypes', err);
    return sendJson(res, 500, { success: false, message: MESSAGES.common.internalServerError, data: null });
  }
}
