import { sendJson } from '../utils/apiResponse.js';
import { MESSAGES } from '../constants/messages.js';
import { UUID_REGEX } from '../utils/validators.js';

function missing(v) {
  if (v === undefined || v === null) return true;
  if (typeof v === 'string' && v.trim() === '') return true;
  return false;
}

export function validateClassIdParam(req, res, next) {
  const { classId } = req.params;
  if (!classId || !UUID_REGEX.test(classId)) {
    return sendJson(res, 400, {
      success: false,
      message: MESSAGES.classSection.invalidClassId,
      data: null,
    });
  }
  next();
}

export function validateSectionIdParam(req, res, next) {
  const { sectionId } = req.params;
  if (!sectionId || !UUID_REGEX.test(sectionId)) {
    return sendJson(res, 400, {
      success: false,
      message: MESSAGES.classSection.invalidSectionId,
      data: null,
    });
  }
  next();
}

export function validateCreateClass(req, res, next) {
  const name = req.body?.name;
  if (missing(name) || String(name).trim().length > 150) {
    return sendJson(res, 400, {
      success: false,
      message: MESSAGES.classSection.classNameInvalid,
      data: null,
    });
  }
  next();
}

export function validateUpdateClass(req, res, next) {
  const name = req.body?.name;
  if (missing(name) || String(name).trim().length > 150) {
    return sendJson(res, 400, {
      success: false,
      message: MESSAGES.classSection.classNameInvalid,
      data: null,
    });
  }
  next();
}

export function validateSectionCodeBody(req, res, next) {
  const code = req.body?.section_code;
  if (missing(code)) {
    return sendJson(res, 400, {
      success: false,
      message: MESSAGES.classSection.sectionCodeRequired,
      data: null,
    });
  }
  const s = String(code).trim();
  if (s.length < 1 || s.length > 10) {
    return sendJson(res, 400, {
      success: false,
      message: MESSAGES.classSection.sectionCodeLength,
      data: null,
    });
  }
  next();
}
