import { sendJson } from '../utils/apiResponse.js';
import { MESSAGES } from '../constants/messages.js';
import * as attendancePatternsService from '../services/attendancePatterns.service.js';
import { actorId } from '../utils/params.js';

function mapAttendanceError(err) {
  const msg = String(err?.message ?? '');
  if (!msg) return null;
  const lower = msg.toLowerCase();
  if (lower.includes('not found')) return { statusCode: 404, message: msg };
  if (lower.includes('required') || lower.includes('must be') || lower.includes('invalid') || lower.includes('does not belong')) {
    return { statusCode: 400, message: msg };
  }
  if (lower.includes('already exists') || lower.includes('overlap')) return { statusCode: 409, message: msg };
  return null;
}

export async function listAttendancePatterns(req, res) {
  try {
    const result = await attendancePatternsService.listAttendancePatterns({
      search: req.query?.search ?? null,
      scope: req.query?.scope ? String(req.query.scope).trim() : null,
      classId: req.query?.classId ? String(req.query.classId).trim() : null,
      sectionId: req.query?.sectionId ? String(req.query.sectionId).trim() : null,
      isActive: req.query?.isActive ?? null,
    });
    return sendJson(res, result.statusCode, { success: result.success, message: result.message, data: result.data });
  } catch (err) {
    const mapped = mapAttendanceError(err);
    if (mapped) return sendJson(res, mapped.statusCode, { success: false, message: mapped.message, data: null });
    console.error('listAttendancePatterns', err);
    return sendJson(res, 500, { success: false, message: MESSAGES.common.internalServerError, data: null });
  }
}

export async function getAttendancePatternById(req, res) {
  try {
    const result = await attendancePatternsService.getAttendancePatternById(req.params.id);
    return sendJson(res, result.statusCode, { success: result.success, message: result.message, data: result.data });
  } catch (err) {
    const mapped = mapAttendanceError(err);
    if (mapped) return sendJson(res, mapped.statusCode, { success: false, message: mapped.message, data: null });
    console.error('getAttendancePatternById', err);
    return sendJson(res, 500, { success: false, message: MESSAGES.common.internalServerError, data: null });
  }
}

export async function createAttendancePattern(req, res) {
  try {
    const userId = actorId(req);
    if (!userId) return sendJson(res, 401, { success: false, message: MESSAGES.common.unauthorized, data: null });
    const result = await attendancePatternsService.createAttendancePattern(req.body, userId);
    return sendJson(res, result.statusCode, { success: result.success, message: result.message, data: result.data });
  } catch (err) {
    const mapped = mapAttendanceError(err);
    if (mapped) return sendJson(res, mapped.statusCode, { success: false, message: mapped.message, data: null });
    console.error('createAttendancePattern', err);
    return sendJson(res, 500, { success: false, message: MESSAGES.common.internalServerError, data: null });
  }
}

export async function updateAttendancePattern(req, res) {
  try {
    const userId = actorId(req);
    if (!userId) return sendJson(res, 401, { success: false, message: MESSAGES.common.unauthorized, data: null });
    const result = await attendancePatternsService.updateAttendancePattern(req.params.id, req.body, userId);
    return sendJson(res, result.statusCode, { success: result.success, message: result.message, data: result.data });
  } catch (err) {
    const mapped = mapAttendanceError(err);
    if (mapped) return sendJson(res, mapped.statusCode, { success: false, message: mapped.message, data: null });
    console.error('updateAttendancePattern', err);
    return sendJson(res, 500, { success: false, message: MESSAGES.common.internalServerError, data: null });
  }
}

export async function versionAttendancePattern(req, res) {
  try {
    const userId = actorId(req);
    if (!userId) return sendJson(res, 401, { success: false, message: MESSAGES.common.unauthorized, data: null });
    const result = await attendancePatternsService.versionAttendancePattern(req.params.id, req.body, userId);
    return sendJson(res, result.statusCode, { success: result.success, message: result.message, data: result.data });
  } catch (err) {
    const mapped = mapAttendanceError(err);
    if (mapped) return sendJson(res, mapped.statusCode, { success: false, message: mapped.message, data: null });
    console.error('versionAttendancePattern', err);
    return sendJson(res, 500, { success: false, message: MESSAGES.common.internalServerError, data: null });
  }
}

export async function deleteAttendancePattern(req, res) {
  try {
    const result = await attendancePatternsService.deleteAttendancePattern(req.params.id);
    return sendJson(res, result.statusCode, { success: result.success, message: result.message, data: result.data });
  } catch (err) {
    const mapped = mapAttendanceError(err);
    if (mapped) return sendJson(res, mapped.statusCode, { success: false, message: mapped.message, data: null });
    console.error('deleteAttendancePattern', err);
    return sendJson(res, 500, { success: false, message: MESSAGES.common.internalServerError, data: null });
  }
}

export async function resolveAttendancePattern(req, res) {
  try {
    const classId = req.query?.classId ? String(req.query.classId).trim() : null;
    const date = req.query?.date ? String(req.query.date).trim() : null;
    const sectionId = req.query?.sectionId ? String(req.query.sectionId).trim() : null;
    const result = await attendancePatternsService.resolveAttendancePattern({ classId, date, sectionId });
    return sendJson(res, result.statusCode, { success: result.success, message: result.message, data: result.data });
  } catch (err) {
    const mapped = mapAttendanceError(err);
    if (mapped) return sendJson(res, mapped.statusCode, { success: false, message: mapped.message, data: null });
    console.error('resolveAttendancePattern', err);
    return sendJson(res, 500, { success: false, message: MESSAGES.common.internalServerError, data: null });
  }
}

