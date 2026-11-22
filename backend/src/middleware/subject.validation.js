import { sendJson } from '../utils/apiResponse.js';
import { MESSAGES } from '../constants/messages.js';
import { UUID_REGEX } from '../utils/validators.js';

function missing(v) {
  if (v === undefined || v === null) return true;
  if (typeof v === 'string' && v.trim() === '') return true;
  return false;
}

export function validateSubjectIdParam(req, res, next) {
  const { id } = req.params;
  if (!id || !UUID_REGEX.test(id)) {
    return sendJson(res, 400, { success: false, message: MESSAGES.subject.invalidId, data: null });
  }
  next();
}

export function validateCreateSubject(req, res, next) {
  const b = req.body ?? {};
  if (missing(b.name) || String(b.name).trim().length > 100) {
    return sendJson(res, 400, { success: false, message: MESSAGES.subject.invalidName, data: null });
  }
  if (b.code !== undefined && b.code !== null && String(b.code).trim().length > 20) {
    return sendJson(res, 400, { success: false, message: MESSAGES.subject.invalidCode, data: null });
  }
  next();
}

export function validateUpdateSubject(req, res, next) {
  const b = req.body ?? {};
  if (missing(b.name) || String(b.name).trim().length > 100) {
    return sendJson(res, 400, { success: false, message: MESSAGES.subject.invalidName, data: null });
  }
  if (b.code !== undefined && b.code !== null && String(b.code).trim().length > 20) {
    return sendJson(res, 400, { success: false, message: MESSAGES.subject.invalidCode, data: null });
  }
  next();
}

export function validateReorderSubjects(req, res, next) {
  const ids = req.body?.ordered_ids;
  if (!Array.isArray(ids) || ids.length === 0) {
    return sendJson(res, 400, { success: false, message: 'ordered_ids must be a non-empty array of UUIDs', data: null });
  }
  if (!ids.every((id) => typeof id === 'string' && UUID_REGEX.test(id))) {
    return sendJson(res, 400, { success: false, message: 'Each ordered_ids entry must be a valid UUID', data: null });
  }
  next();
}

