import { sendJson } from '../utils/apiResponse.js';
import { MESSAGES } from '../constants/messages.js';
import * as subjectService from '../services/subject.service.js';
import { actorId } from '../utils/params.js';

function mapSubjectError(err) {
  const msg = String(err?.message ?? '');
  if (!msg) return null;
  const lower = msg.toLowerCase();
  if (lower.includes('subject not found')) return { statusCode: 404, message: MESSAGES.subject.notFoundMsg };
  if (lower.includes('already exists')) return { statusCode: 409, message: MESSAGES.subject.alreadyExists };
  if (lower.includes('required')) return { statusCode: 400, message: msg };
  return null;
}

export async function getSubjects(req, res) {
  try {
    const result = await subjectService.getSubjects(req.query?.search ?? null);
    return sendJson(res, result.statusCode, { success: result.success, message: result.message, data: result.data });
  } catch (err) {
    console.error('getSubjects', err);
    return sendJson(res, 500, { success: false, message: MESSAGES.common.internalServerError, data: null });
  }
}

export async function createSubject(req, res) {
  try {
    const userId = actorId(req);
    if (!userId) return sendJson(res, 401, { success: false, message: MESSAGES.common.unauthorized, data: null });
    const result = await subjectService.createSubject(req.body, userId);
    return sendJson(res, result.statusCode, { success: result.success, message: result.message, data: result.data });
  } catch (err) {
    const mapped = mapSubjectError(err);
    if (mapped) return sendJson(res, mapped.statusCode, { success: false, message: mapped.message, data: null });
    console.error('createSubject', err);
    return sendJson(res, 500, { success: false, message: MESSAGES.common.internalServerError, data: null });
  }
}

export async function updateSubject(req, res) {
  try {
    const userId = actorId(req);
    if (!userId) return sendJson(res, 401, { success: false, message: MESSAGES.common.unauthorized, data: null });
    const result = await subjectService.updateSubject(req.params.id, req.body, userId);
    return sendJson(res, result.statusCode, { success: result.success, message: result.message, data: result.data });
  } catch (err) {
    const mapped = mapSubjectError(err);
    if (mapped) return sendJson(res, mapped.statusCode, { success: false, message: mapped.message, data: null });
    console.error('updateSubject', err);
    return sendJson(res, 500, { success: false, message: MESSAGES.common.internalServerError, data: null });
  }
}

export async function deleteSubject(req, res) {
  try {
    const userId = actorId(req);
    if (!userId) return sendJson(res, 401, { success: false, message: MESSAGES.common.unauthorized, data: null });
    const result = await subjectService.deleteSubject(req.params.id, userId);
    return sendJson(res, result.statusCode, { success: result.success, message: result.message, data: result.data });
  } catch (err) {
    const mapped = mapSubjectError(err);
    if (mapped) return sendJson(res, mapped.statusCode, { success: false, message: mapped.message, data: null });
    console.error('deleteSubject', err);
    return sendJson(res, 500, { success: false, message: MESSAGES.common.internalServerError, data: null });
  }
}

export async function restoreSubject(req, res) {
  try {
    const userId = actorId(req);
    if (!userId) return sendJson(res, 401, { success: false, message: MESSAGES.common.unauthorized, data: null });
    const result = await subjectService.restoreSubject(req.params.id, userId);
    return sendJson(res, result.statusCode, { success: result.success, message: result.message, data: result.data });
  } catch (err) {
    console.error('restoreSubject', err);
    return sendJson(res, 500, { success: false, message: MESSAGES.common.internalServerError, data: null });
  }
}

export async function toggleSubjectStatus(req, res) {
  try {
    const userId = actorId(req);
    if (!userId) return sendJson(res, 401, { success: false, message: MESSAGES.common.unauthorized, data: null });
    const result = await subjectService.toggleSubjectStatus(req.params.id, userId);
    return sendJson(res, result.statusCode, { success: result.success, message: result.message, data: result.data });
  } catch (err) {
    console.error('toggleSubjectStatus', err);
    return sendJson(res, 500, { success: false, message: MESSAGES.common.internalServerError, data: null });
  }
}

export async function reorderSubjects(req, res) {
  try {
    const userId = actorId(req);
    if (!userId) return sendJson(res, 401, { success: false, message: MESSAGES.common.unauthorized, data: null });
    const result = await subjectService.reorderSubjects(req.body.ordered_ids);
    return sendJson(res, result.statusCode, { success: result.success, message: result.message, data: result.data });
  } catch (err) {
    const mapped = mapSubjectError(err);
    if (mapped) return sendJson(res, mapped.statusCode, { success: false, message: mapped.message, data: null });
    const msg = String(err?.message ?? '');
    if (msg.toLowerCase().includes('ordered_ids')) {
      return sendJson(res, 400, { success: false, message: msg, data: null });
    }
    console.error('reorderSubjects', err);
    return sendJson(res, 500, { success: false, message: MESSAGES.common.internalServerError, data: null });
  }
}

