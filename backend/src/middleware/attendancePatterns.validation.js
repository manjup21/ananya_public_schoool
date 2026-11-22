import { sendJson } from '../utils/apiResponse.js';
import { UUID_REGEX, isUuid } from '../utils/validators.js';

const SCOPE = ['global', 'class', 'section'];

function missing(v) {
  if (v === undefined || v === null) return true;
  if (typeof v === 'string' && v.trim() === '') return true;
  return false;
}

function isDateString(v) {
  if (missing(v)) return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(String(v).trim());
}

function isHHmm(v) {
  if (missing(v)) return false;
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(String(v).trim());
}

function isDayOfWeekInt(n) {
  return Number.isInteger(n) && n >= 0 && n <= 6;
}

function normalizeSlotName(v) {
  if (missing(v)) return '';
  return String(v).trim().replace(/\s+/g, ' ');
}

function getSlotName(item) {
  if (typeof item === 'string') return normalizeSlotName(item);
  if (item && typeof item === 'object') return normalizeSlotName(item.slot_name ?? item.name ?? item.label);
  return '';
}

function validateSlotNamesArray(arr) {
  if (!Array.isArray(arr) || arr.length < 1 || arr.length > 10) return { ok: false, message: 'Slots must have 1..10 items' };
  const names = arr.map(getSlotName);
  if (names.some((n) => !n)) return { ok: false, message: 'All slot names are required' };
  const lower = names.map((n) => n.toLowerCase());
  const uniq = new Set(lower);
  if (uniq.size !== lower.length) return { ok: false, message: 'Slot names must be unique (case-insensitive)' };
  return { ok: true };
}

export function validateAttendancePatternIdParam(req, res, next) {
  const { id } = req.params;
  if (!id || !UUID_REGEX.test(id)) {
    return sendJson(res, 400, { success: false, message: 'Valid pattern id (UUID) is required', data: null });
  }
  next();
}

export function validateCreateAttendancePattern(req, res, next) {
  const b = req.body ?? {};
  const hasNewSlotsShape =
    b.same_slots_all_days !== undefined || b.slots_global !== undefined || b.slots_by_dow !== undefined;

  if (missing(b.name) || String(b.name).trim().length > 150) {
    return sendJson(res, 400, { success: false, message: 'name is required (max 150 characters)', data: null });
  }
  if (missing(b.scope) || !SCOPE.includes(String(b.scope))) {
    return sendJson(res, 400, { success: false, message: 'scope must be one of: global, class, section', data: null });
  }
  if (!isDateString(b.start_date) || !isDateString(b.end_date)) {
    return sendJson(res, 400, { success: false, message: 'start_date and end_date must be YYYY-MM-DD', data: null });
  }
  if (String(b.scope) !== 'global') {
    if (missing(b.class_id) || !isUuid(b.class_id)) {
      return sendJson(res, 400, { success: false, message: 'class_id (UUID) is required for class/section scope', data: null });
    }
  } else if (b.class_id !== undefined && b.class_id !== null && String(b.class_id).trim() !== '') {
    return sendJson(res, 400, { success: false, message: 'class_id must be empty for global scope', data: null });
  }
  if (String(b.scope) === 'section') {
    const hasSectionId = !missing(b.section_id) && isUuid(b.section_id);
    const hasSectionIds =
      Array.isArray(b.section_ids) && b.section_ids.length > 0 && b.section_ids.every((x) => isUuid(x));
    if (!hasSectionId && !hasSectionIds) {
      return sendJson(res, 400, {
        success: false,
        message: 'For section scope, provide section_id (UUID) or section_ids (non-empty array of UUIDs)',
        data: null,
      });
    }
  }

  if (!Array.isArray(b.days_of_week) || b.days_of_week.length < 1) {
    return sendJson(res, 400, { success: false, message: 'days_of_week must be a non-empty array (0=Sun..6=Sat)', data: null });
  }
  if (b.days_of_week.some((x) => !isDayOfWeekInt(Number(x)))) {
    return sendJson(res, 400, { success: false, message: 'days_of_week values must be integers 0..6', data: null });
  }

  if (!hasNewSlotsShape) {
    if (!Array.isArray(b.slot_times) || b.slot_times.length < 1 || b.slot_times.length > 10) {
      return sendJson(res, 400, { success: false, message: 'slot_times must be an array with 1..10 items (HH:mm)', data: null });
    }
    if (b.slot_times.some((t) => !isHHmm(t))) {
      return sendJson(res, 400, { success: false, message: 'Each slot_time must be HH:mm', data: null });
    }
    return next();
  }

  if (b.same_slots_all_days !== undefined && b.same_slots_all_days !== null && typeof b.same_slots_all_days !== 'boolean') {
    return sendJson(res, 400, { success: false, message: 'same_slots_all_days must be boolean', data: null });
  }
  const same = b.same_slots_all_days === undefined || b.same_slots_all_days === null ? true : b.same_slots_all_days;
  if (same) {
    const v = validateSlotNamesArray(b.slots_global);
    if (!v.ok) return sendJson(res, 400, { success: false, message: v.message, data: null });
  } else {
    if (!b.slots_by_dow || typeof b.slots_by_dow !== 'object' || Array.isArray(b.slots_by_dow)) {
      return sendJson(res, 400, { success: false, message: 'slots_by_dow must be an object keyed by day-of-week', data: null });
    }
    for (const d of b.days_of_week.map((x) => Number(x))) {
      const arr = b.slots_by_dow[String(d)];
      const v = validateSlotNamesArray(arr);
      if (!v.ok) return sendJson(res, 400, { success: false, message: v.message, data: null });
    }
  }

  next();
}

export function validateUpdateAttendancePattern(req, res, next) {
  const b = req.body ?? {};
  const hasNewSlotsShape =
    b.same_slots_all_days !== undefined || b.slots_global !== undefined || b.slots_by_dow !== undefined;

  if (b.name !== undefined && b.name !== null && String(b.name).trim().length > 150) {
    return sendJson(res, 400, { success: false, message: 'name must be <= 150 characters', data: null });
  }
  if (b.scope !== undefined && b.scope !== null && !SCOPE.includes(String(b.scope))) {
    return sendJson(res, 400, { success: false, message: 'scope must be one of: global, class, section', data: null });
  }
  if (b.class_id !== undefined && b.class_id !== null && String(b.class_id).trim() !== '' && !isUuid(b.class_id)) {
    return sendJson(res, 400, { success: false, message: 'class_id must be a valid UUID', data: null });
  }
  if (b.section_id !== undefined && b.section_id !== null && String(b.section_id).trim() !== '' && !isUuid(b.section_id)) {
    return sendJson(res, 400, { success: false, message: 'section_id must be a valid UUID', data: null });
  }
  if (b.start_date !== undefined && b.start_date !== null && String(b.start_date).trim() !== '' && !isDateString(b.start_date)) {
    return sendJson(res, 400, { success: false, message: 'start_date must be YYYY-MM-DD', data: null });
  }
  if (b.end_date !== undefined && b.end_date !== null && String(b.end_date).trim() !== '' && !isDateString(b.end_date)) {
    return sendJson(res, 400, { success: false, message: 'end_date must be YYYY-MM-DD', data: null });
  }

  if (b.days_of_week !== undefined && b.days_of_week !== null) {
    if (!Array.isArray(b.days_of_week) || b.days_of_week.length < 1) {
      return sendJson(res, 400, { success: false, message: 'days_of_week must be a non-empty array (0=Sun..6=Sat)', data: null });
    }
    if (b.days_of_week.some((x) => !isDayOfWeekInt(Number(x)))) {
      return sendJson(res, 400, { success: false, message: 'days_of_week values must be integers 0..6', data: null });
    }
  }

  if (b.slot_times !== undefined && b.slot_times !== null) {
    if (!Array.isArray(b.slot_times) || b.slot_times.length < 1 || b.slot_times.length > 10) {
      return sendJson(res, 400, { success: false, message: 'slot_times must be an array with 1..10 items (HH:mm)', data: null });
    }
    if (b.slot_times.some((t) => !isHHmm(t))) {
      return sendJson(res, 400, { success: false, message: 'Each slot_time must be HH:mm', data: null });
    }
  }

  if (hasNewSlotsShape) {
    if (b.same_slots_all_days !== undefined && b.same_slots_all_days !== null && typeof b.same_slots_all_days !== 'boolean') {
      return sendJson(res, 400, { success: false, message: 'same_slots_all_days must be boolean', data: null });
    }
    const same =
      b.same_slots_all_days === undefined || b.same_slots_all_days === null ? (b.slots_by_dow ? false : true) : b.same_slots_all_days;

    if (same) {
      if (b.slots_global !== undefined && b.slots_global !== null) {
        const v = validateSlotNamesArray(b.slots_global);
        if (!v.ok) return sendJson(res, 400, { success: false, message: v.message, data: null });
      }
    } else {
      if (b.slots_by_dow !== undefined && b.slots_by_dow !== null) {
        if (typeof b.slots_by_dow !== 'object' || Array.isArray(b.slots_by_dow)) {
          return sendJson(res, 400, { success: false, message: 'slots_by_dow must be an object keyed by day-of-week', data: null });
        }
        if (b.days_of_week !== undefined && b.days_of_week !== null) {
          for (const d of b.days_of_week.map((x) => Number(x))) {
            const arr = b.slots_by_dow[String(d)];
            const v = validateSlotNamesArray(arr);
            if (!v.ok) return sendJson(res, 400, { success: false, message: v.message, data: null });
          }
        } else {
          // If days_of_week isn't being updated, we can still validate whichever days are provided in slots_by_dow.
          for (const [dow, arr] of Object.entries(b.slots_by_dow)) {
            if (!isDayOfWeekInt(Number(dow))) {
              return sendJson(res, 400, { success: false, message: 'slots_by_dow keys must be 0..6', data: null });
            }
            const v = validateSlotNamesArray(arr);
            if (!v.ok) return sendJson(res, 400, { success: false, message: v.message, data: null });
          }
        }
      }
    }
  }

  if (b.is_active !== undefined && b.is_active !== null && typeof b.is_active !== 'boolean') {
    return sendJson(res, 400, { success: false, message: 'is_active must be boolean', data: null });
  }

  next();
}

export function validateVersionAttendancePattern(req, res, next) {
  const b = req.body ?? {};
  if (b.start_date !== undefined && b.start_date !== null && String(b.start_date).trim() !== '') {
    return sendJson(res, 400, { success: false, message: 'start_date cannot be set when versioning (effective date is fixed to tomorrow)', data: null });
  }

  const hasNewSlotsShape =
    b.same_slots_all_days !== undefined || b.slots_global !== undefined || b.slots_by_dow !== undefined;

  if (missing(b.name) || String(b.name).trim().length > 150) {
    return sendJson(res, 400, { success: false, message: 'name is required (max 150 characters)', data: null });
  }
  if (missing(b.scope) || !SCOPE.includes(String(b.scope))) {
    return sendJson(res, 400, { success: false, message: 'scope must be one of: global, class, section', data: null });
  }

  if (b.end_date !== undefined && b.end_date !== null && String(b.end_date).trim() !== '' && !isDateString(b.end_date)) {
    return sendJson(res, 400, { success: false, message: 'end_date must be YYYY-MM-DD when provided', data: null });
  }

  if (String(b.scope) !== 'global') {
    if (missing(b.class_id) || !isUuid(b.class_id)) {
      return sendJson(res, 400, { success: false, message: 'class_id (UUID) is required for class/section scope', data: null });
    }
  } else if (b.class_id !== undefined && b.class_id !== null && String(b.class_id).trim() !== '') {
    return sendJson(res, 400, { success: false, message: 'class_id must be empty for global scope', data: null });
  }
  if (String(b.scope) === 'section') {
    if (missing(b.section_id) || !isUuid(b.section_id)) {
      return sendJson(res, 400, { success: false, message: 'section_id (UUID) is required for section scope', data: null });
    }
  }

  if (!Array.isArray(b.days_of_week) || b.days_of_week.length < 1) {
    return sendJson(res, 400, { success: false, message: 'days_of_week must be a non-empty array (0=Sun..6=Sat)', data: null });
  }
  if (b.days_of_week.some((x) => !isDayOfWeekInt(Number(x)))) {
    return sendJson(res, 400, { success: false, message: 'days_of_week values must be integers 0..6', data: null });
  }

  if (!hasNewSlotsShape) {
    if (!Array.isArray(b.slot_times) || b.slot_times.length < 1 || b.slot_times.length > 10) {
      return sendJson(res, 400, { success: false, message: 'slot_times must be an array with 1..10 items (HH:mm)', data: null });
    }
    if (b.slot_times.some((t) => !isHHmm(t))) {
      return sendJson(res, 400, { success: false, message: 'Each slot_time must be HH:mm', data: null });
    }
    return next();
  }

  if (b.same_slots_all_days !== undefined && b.same_slots_all_days !== null && typeof b.same_slots_all_days !== 'boolean') {
    return sendJson(res, 400, { success: false, message: 'same_slots_all_days must be boolean', data: null });
  }
  const same = b.same_slots_all_days === undefined || b.same_slots_all_days === null ? true : b.same_slots_all_days;
  if (same) {
    const v = validateSlotNamesArray(b.slots_global);
    if (!v.ok) return sendJson(res, 400, { success: false, message: v.message, data: null });
  } else {
    if (!b.slots_by_dow || typeof b.slots_by_dow !== 'object' || Array.isArray(b.slots_by_dow)) {
      return sendJson(res, 400, { success: false, message: 'slots_by_dow must be an object keyed by day-of-week', data: null });
    }
    for (const d of b.days_of_week.map((x) => Number(x))) {
      const arr = b.slots_by_dow[String(d)];
      const v = validateSlotNamesArray(arr);
      if (!v.ok) return sendJson(res, 400, { success: false, message: v.message, data: null });
    }
  }

  next();
}

