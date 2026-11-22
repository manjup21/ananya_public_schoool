import { sendJson } from '../utils/apiResponse.js';
import { MESSAGES } from '../constants/messages.js';
import * as lecturerService from '../services/lecturer.service.js';

function callerAuth(req) {
  const legacyAdmin =
    String(req.auth?.role ?? '').toLowerCase() === 'admin' && req.auth?.is_super_admin == null;
  return {
    is_super_admin: req.auth?.is_super_admin === true || legacyAdmin,
    is_admin: req.auth?.is_admin === true || legacyAdmin,
    can_manage_fees: req.auth?.can_manage_fees === true,
  };
}

export async function createLecturer(req, res) {
  try {
    const result = await lecturerService.createLecturer(req.body, { callerAuth: callerAuth(req) });
    return sendJson(res, result.statusCode, {
      success: result.success,
      message: result.message,
      data: result.data,
    });
  } catch (err) {
    console.error('createLecturer', err);
    return sendJson(res, 500, { success: false, message: MESSAGES.common.internalServerError, data: null });
  }
}

export async function updateLecturer(req, res) {
  try {
    const result = await lecturerService.updateLecturer(req.params.id, req.body, {
      callerAuth: callerAuth(req),
    });
    return sendJson(res, result.statusCode, {
      success: result.success,
      message: result.message,
      data: result.data,
    });
  } catch (err) {
    console.error('updateLecturer', err);
    return sendJson(res, 500, { success: false, message: MESSAGES.common.internalServerError, data: null });
  }
}

export async function deleteLecturer(req, res) {
  try {
    const result = await lecturerService.deleteLecturer(req.params.id);
    return sendJson(res, result.statusCode, {
      success: result.success,
      message: result.message,
      data: result.data,
    });
  } catch (err) {
    console.error('deleteLecturer', err);
    return sendJson(res, 500, { success: false, message: MESSAGES.common.internalServerError, data: null });
  }
}

export async function getLecturers(req, res) {
  try {
    const result = await lecturerService.getLecturers(req.validatedQuery);
    return sendJson(res, result.statusCode, {
      success: result.success,
      message: result.message,
      data: result.data,
    });
  } catch (err) {
    console.error('getLecturers', err);
    return sendJson(res, 500, { success: false, message: MESSAGES.common.internalServerError, data: null });
  }
}

export async function getLecturerById(req, res) {
  try {
    const result = await lecturerService.getLecturerById(req.params.id);
    return sendJson(res, result.statusCode, {
      success: result.success,
      message: result.message,
      data: result.data,
    });
  } catch (err) {
    console.error('getLecturerById', err);
    return sendJson(res, 500, { success: false, message: MESSAGES.common.internalServerError, data: null });
  }
}

export async function resetLecturerPassword(req, res) {
  try {
    const result = await lecturerService.resetLecturerPassword(req.params.id);
    return sendJson(res, result.statusCode, {
      success: result.success,
      message: result.message,
      data: result.data,
    });
  } catch (err) {
    console.error('resetLecturerPassword', err);
    return sendJson(res, 500, { success: false, message: MESSAGES.common.internalServerError, data: null });
  }
}
