import { sendJson } from '../utils/apiResponse.js';
import { MESSAGES } from '../constants/messages.js';
import { UUID_REGEX } from '../utils/validators.js';

function missing(v) {
  if (v === undefined || v === null) return true;
  if (typeof v === 'string' && v.trim() === '') return true;
  if (Array.isArray(v) && v.length === 0) return true;
  return false;
}

function isValidIndianPhone(phoneRaw) {
  const s = String(phoneRaw ?? '').trim();
  if (!s.startsWith('+91')) return false;
  const rest = s.slice(3);
  return /^[0-9]{10}$/.test(rest);
}

function normalizeName(v) {
  return String(v ?? '').trim().replace(/\s+/g, ' ');
}

function isEnglishName(v) {
  const s = normalizeName(v);
  if (!s) return false;
  // English alphabets and spaces only.
  return /^[A-Za-z ]+$/.test(s);
}

export function validateLecturerIdParam(req, res, next) {
  const { id } = req.params;
  if (!id || !UUID_REGEX.test(id)) {
    return sendJson(res, 400, { success: false, message: MESSAGES.lecturer.invalidId, data: null });
  }
  next();
}

function validateCapabilityBooleans(b, res) {
  for (const key of ['is_super_admin', 'is_admin', 'can_manage_fees', 'make_admin', 'make_fee_manager']) {
    if (b[key] !== undefined && b[key] !== null && typeof b[key] !== 'boolean') {
      sendJson(res, 400, { success: false, message: `${key} must be a boolean`, data: null });
      return false;
    }
  }
  return true;
}

export function validateCreateLecturer(req, res, next) {
  const b = req.body ?? {};
  if (!validateCapabilityBooleans(b, res)) return;
  const errors = [];
  // title required by UI (DB allows null)
  if (missing(b.title)) errors.push('title');
  if (missing(b.first_name)) errors.push('first_name');
  if (missing(b.last_name)) errors.push('last_name');
  if (missing(b.employee_id)) errors.push('employee_id');
  if (missing(b.email)) errors.push('email');
  if (missing(b.phone) || !isValidIndianPhone(b.phone)) errors.push('phone');
  if (missing(b.date_of_birth)) errors.push('date_of_birth');
  if (missing(b.subjects)) errors.push('subjects');
  // password optional: server sets default 6-digit PIN (STAFF_DEFAULT_PIN / 000000)

  if (errors.length) {
    return sendJson(res, 400, {
      success: false,
      message: `${MESSAGES.lecturer.requiredFieldsMissing}: ${errors.join(', ')}`,
      data: null,
    });
  }

  if (!isEnglishName(b.first_name)) {
    return sendJson(res, 400, { success: false, message: 'First name must contain only English letters', data: null });
  }
  if (!isEnglishName(b.last_name)) {
    return sendJson(res, 400, { success: false, message: 'Last name must contain only English letters', data: null });
  }

  next();
}

export function validateUpdateLecturer(req, res, next) {
  const b = req.body ?? {};
  if (!validateCapabilityBooleans(b, res)) return;
  const hasAny =
    b.title !== undefined ||
    b.first_name !== undefined ||
    b.last_name !== undefined ||
    b.employee_id !== undefined ||
    b.email !== undefined ||
    b.phone !== undefined ||
    b.date_of_birth !== undefined ||
    b.subjects !== undefined ||
    b.is_super_admin !== undefined ||
    b.is_admin !== undefined ||
    b.can_manage_fees !== undefined ||
    b.make_admin !== undefined ||
    b.make_fee_manager !== undefined;

  if (!hasAny) {
    return sendJson(res, 400, {
      success: false,
      message: MESSAGES.lecturer.requiredFieldsMissing,
      data: null,
    });
  }

  if (b.phone !== undefined && b.phone !== null && String(b.phone).trim() !== '') {
    if (!isValidIndianPhone(b.phone)) {
      return sendJson(res, 400, {
        success: false,
        message: 'phone must be in format +91XXXXXXXXXX (10 digits after +91)',
        data: null,
      });
    }
  }

  if (b.first_name !== undefined && b.first_name !== null && String(b.first_name).trim() !== '') {
    if (!isEnglishName(b.first_name)) {
      return sendJson(res, 400, { success: false, message: 'First name must contain only English letters', data: null });
    }
  }
  if (b.last_name !== undefined && b.last_name !== null && String(b.last_name).trim() !== '') {
    if (!isEnglishName(b.last_name)) {
      return sendJson(res, 400, { success: false, message: 'Last name must contain only English letters', data: null });
    }
  }

  next();
}

export function validateGetLecturersQuery(req, res, next) {
  const pageRaw = req.query.page;
  const limitRaw = req.query.limit;
  const page = pageRaw === undefined ? 1 : Number(pageRaw);
  const limit = limitRaw === undefined ? 10 : Number(limitRaw);

  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1) {
    return sendJson(res, 400, { success: false, message: MESSAGES.lecturer.invalidPagination, data: null });
  }

  req.validatedQuery = {
    page,
    limit,
    search:
      req.query.search === undefined || req.query.search === null || req.query.search === ''
        ? null
        : String(req.query.search),
  };
  next();
}

