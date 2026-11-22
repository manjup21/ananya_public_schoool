import { sendJson } from '../utils/apiResponse.js';
import { isUuid } from '../utils/validators.js';

function missing(v) {
  if (v === undefined || v === null) return true;
  if (typeof v === 'string' && v.trim() === '') return true;
  return false;
}

function isDateString(v) {
  if (missing(v)) return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(String(v).trim());
}

function dateOrderOk(from, to) {
  if (!isDateString(from) || !isDateString(to)) return true;
  return String(to) >= String(from);
}

export function validateSchoolHolidayIdParam(req, res, next) {
  const { id } = req.params;
  if (!id || !isUuid(id)) {
    return sendJson(res, 400, { success: false, message: 'Valid holiday id (UUID) is required', data: null });
  }
  next();
}

export function validateCreateSchoolHoliday(req, res, next) {
  const b = req.body ?? {};
  if (missing(b.name) || String(b.name).trim().length > 150) {
    return sendJson(res, 400, { success: false, message: 'name is required (max 150 characters)', data: null });
  }
  if (!isDateString(b.start_date)) {
    return sendJson(res, 400, { success: false, message: 'start_date must be YYYY-MM-DD', data: null });
  }
  const start = String(b.start_date).trim();
  const endRaw = missing(b.end_date) ? start : String(b.end_date).trim();
  if (!isDateString(endRaw)) {
    return sendJson(res, 400, {
      success: false,
      message: 'end_date must be YYYY-MM-DD when provided; omit it for a single-day holiday',
      data: null,
    });
  }
  if (endRaw < start) {
    return sendJson(res, 400, { success: false, message: 'end_date must be on or after start_date', data: null });
  }
  req.body.start_date = start;
  req.body.end_date = endRaw;
  next();
}

export function validateUpdateSchoolHoliday(req, res, next) {
  const b = req.body ?? {};
  const hasName = b.name !== undefined && b.name !== null;
  const hasStart = b.start_date !== undefined && b.start_date !== null;
  const hasEnd = b.end_date !== undefined && b.end_date !== null;
  const hasActive = b.is_active !== undefined && b.is_active !== null;

  if (!hasName && !hasStart && !hasEnd && !hasActive) {
    return sendJson(res, 400, { success: false, message: 'Provide at least one of: name, start_date, end_date, is_active', data: null });
  }

  if (hasName && (String(b.name).trim() === '' || String(b.name).trim().length > 150)) {
    return sendJson(res, 400, { success: false, message: 'name must be 1–150 characters', data: null });
  }
  if (hasStart && !isDateString(b.start_date)) {
    return sendJson(res, 400, { success: false, message: 'start_date must be YYYY-MM-DD', data: null });
  }
  if (hasEnd && !isDateString(b.end_date)) {
    return sendJson(res, 400, { success: false, message: 'end_date must be YYYY-MM-DD', data: null });
  }

  const from = hasStart ? String(b.start_date).trim() : null;
  const to = hasEnd ? String(b.end_date).trim() : null;
  if (from && to && to < from) {
    return sendJson(res, 400, { success: false, message: 'end_date must be on or after start_date', data: null });
  }

  if (hasActive) {
    const v = b.is_active;
    const ok =
      typeof v === 'boolean' ||
      v === 0 ||
      v === 1 ||
      v === 'true' ||
      v === 'false' ||
      v === '0' ||
      v === '1';
    if (!ok) {
      return sendJson(res, 400, { success: false, message: 'is_active must be a boolean', data: null });
    }
  }

  next();
}

export function validateListSchoolHolidayQuery(req, res, next) {
  const q = req.query ?? {};
  if (q.from !== undefined && q.from !== null && String(q.from).trim() !== '' && !isDateString(q.from)) {
    return sendJson(res, 400, { success: false, message: 'from must be YYYY-MM-DD when provided', data: null });
  }
  if (q.to !== undefined && q.to !== null && String(q.to).trim() !== '' && !isDateString(q.to)) {
    return sendJson(res, 400, { success: false, message: 'to must be YYYY-MM-DD when provided', data: null });
  }
  if (!dateOrderOk(q.from, q.to)) {
    return sendJson(res, 400, { success: false, message: 'to must be on or after from', data: null });
  }
  next();
}
