import { sendJson } from '../utils/apiResponse.js';
import { MESSAGES } from '../constants/messages.js';
import { UUID_REGEX, isUuid } from '../utils/validators.js';

const STATUS = ['scheduled', 'ongoing', 'completed', 'cancelled'];

function missing(v) {
  if (v === undefined || v === null) return true;
  if (typeof v === 'string' && v.trim() === '') return true;
  return false;
}

function isTimeString(v) {
  // accept HH:MM or HH:MM:SS
  if (missing(v)) return false;
  return /^\d{2}:\d{2}(:\d{2})?$/.test(String(v).trim());
}

function isDateString(v) {
  if (missing(v)) return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(String(v).trim());
}

export function validateExamIdParam(req, res, next) {
  const { id } = req.params;
  if (!id || !UUID_REGEX.test(id)) {
    return sendJson(res, 400, { success: false, message: MESSAGES.examination?.invalidId ?? 'Valid examination id (UUID) is required', data: null });
  }
  next();
}

export function validateCreateExamination(req, res, next) {
  const b = req.body ?? {};

  if (missing(b.test_name) || String(b.test_name).trim().length > 150) {
    return sendJson(res, 400, { success: false, message: 'Test name is required (max 150 characters)', data: null });
  }
  if (missing(b.exam_type_id) || !isUuid(b.exam_type_id)) {
    return sendJson(res, 400, { success: false, message: 'Valid exam_type_id (UUID) is required', data: null });
  }
  if (missing(b.exam_status) || !STATUS.includes(String(b.exam_status))) {
    return sendJson(res, 400, { success: false, message: 'Valid exam_status is required', data: null });
  }
  if (missing(b.class_id) || !isUuid(b.class_id)) {
    return sendJson(res, 400, { success: false, message: 'Valid class_id (UUID) is required', data: null });
  }
  if (b.section_id !== undefined && b.section_id !== null && String(b.section_id).trim() !== '' && !isUuid(b.section_id)) {
    return sendJson(res, 400, { success: false, message: 'section_id must be a valid UUID', data: null });
  }
  if (b.section_ids !== undefined && b.section_ids !== null) {
    if (!Array.isArray(b.section_ids) || b.section_ids.length < 1 || b.section_ids.some((x) => !isUuid(x))) {
      return sendJson(res, 400, { success: false, message: 'section_ids must be a non-empty array of UUIDs', data: null });
    }
  }

  if (!Array.isArray(b.subject_ids) || b.subject_ids.length < 1 || b.subject_ids.some((x) => !isUuid(x))) {
    return sendJson(res, 400, { success: false, message: 'subject_ids must be a non-empty array of UUIDs', data: null });
  }

  if (b.part_b_subject_ids !== undefined && b.part_b_subject_ids !== null) {
    if (!Array.isArray(b.part_b_subject_ids) || b.part_b_subject_ids.some((x) => !isUuid(x))) {
      return sendJson(res, 400, { success: false, message: 'part_b_subject_ids must be an array of UUIDs', data: null });
    }
    const partA = new Set(b.subject_ids.map(String));
    if (b.part_b_subject_ids.some((id) => partA.has(String(id)))) {
      return sendJson(res, 400, { success: false, message: 'Part B subjects must not overlap Part A subjects', data: null });
    }
  }

  const hasSubjMax = b.subject_max_marks !== undefined && b.subject_max_marks !== null;
  const hasSubjPass = b.subject_passing_marks !== undefined && b.subject_passing_marks !== null;
  if (hasSubjPass && !hasSubjMax) {
    return sendJson(res, 400, { success: false, message: 'subject_max_marks is required when sending subject_passing_marks', data: null });
  }
  if (hasSubjMax) {
    if (!Array.isArray(b.subject_max_marks)) {
      return sendJson(res, 400, { success: false, message: 'Per-subject max marks must be an array', data: null });
    }
    if (b.subject_max_marks.length !== b.subject_ids.length) {
      return sendJson(res, 400, { success: false, message: 'Per-subject marks arrays must match subject_ids length', data: null });
    }
    if (hasSubjPass) {
      if (!Array.isArray(b.subject_passing_marks)) {
        return sendJson(res, 400, { success: false, message: 'Per-subject passing marks must be an array', data: null });
      }
      if (b.subject_passing_marks.length !== b.subject_ids.length) {
        return sendJson(res, 400, { success: false, message: 'Per-subject marks arrays must match subject_ids length', data: null });
      }
    }
    let sumMax = 0;
    let sumPass = 0;
    let anyPass = false;
    for (let i = 0; i < b.subject_ids.length; i += 1) {
      const sm = Number(b.subject_max_marks[i]);
      if (!Number.isFinite(sm) || sm <= 0) {
        return sendJson(res, 400, { success: false, message: 'Each subject_max_marks must be > 0', data: null });
      }
      sumMax += sm;
      const rawPass = hasSubjPass ? b.subject_passing_marks[i] : null;
      if (rawPass !== undefined && rawPass !== null && rawPass !== '') {
        const sp = Number(rawPass);
        if (!Number.isFinite(sp) || sp < 0 || sp > sm) {
          return sendJson(res, 400, { success: false, message: 'Each subject_passing_marks must be between 0 and that subject max', data: null });
        }
        sumPass += sp;
        anyPass = true;
      }
    }
    if (anyPass && sumPass > sumMax) {
      return sendJson(res, 400, { success: false, message: 'Total passing marks must be <= total max marks', data: null });
    }
  }

  if (!isDateString(b.exam_date) && !Array.isArray(b.subject_exam_dates)) {
    return sendJson(res, 400, { success: false, message: 'exam_date or subject_exam_dates is required', data: null });
  }
  if (Array.isArray(b.subject_exam_dates)) {
    if (b.subject_exam_dates.length !== b.subject_ids.length) {
      return sendJson(res, 400, { success: false, message: 'subject_exam_dates must match subject_ids length', data: null });
    }
    for (let i = 0; i < b.subject_exam_dates.length; i += 1) {
      if (!isDateString(b.subject_exam_dates[i])) {
        return sendJson(res, 400, { success: false, message: 'Each subject_exam_dates entry must be YYYY-MM-DD', data: null });
      }
    }
  } else if (!isDateString(b.exam_date)) {
    return sendJson(res, 400, { success: false, message: 'exam_date must be YYYY-MM-DD', data: null });
  }

  if (b.subject_start_times !== undefined && b.subject_start_times !== null) {
    if (!Array.isArray(b.subject_start_times) || b.subject_start_times.length !== b.subject_ids.length) {
      return sendJson(res, 400, { success: false, message: 'subject_start_times must match subject_ids length', data: null });
    }
  }
  if (b.subject_end_times !== undefined && b.subject_end_times !== null) {
    if (!Array.isArray(b.subject_end_times) || b.subject_end_times.length !== b.subject_ids.length) {
      return sendJson(res, 400, { success: false, message: 'subject_end_times must match subject_ids length', data: null });
    }
  }
  const starts = Array.isArray(b.subject_start_times) ? b.subject_start_times : null;
  const ends = Array.isArray(b.subject_end_times) ? b.subject_end_times : null;
  if (starts || ends) {
    const n = b.subject_ids.length;
    for (let i = 0; i < n; i += 1) {
      const st = starts ? starts[i] : null;
      const en = ends ? ends[i] : null;
      const hasSt = st !== undefined && st !== null && String(st).trim() !== '';
      const hasEn = en !== undefined && en !== null && String(en).trim() !== '';
      if (hasSt && !isTimeString(st)) {
        return sendJson(res, 400, { success: false, message: 'subject_start_times must be HH:MM or HH:MM:SS', data: null });
      }
      if (hasEn && !isTimeString(en)) {
        return sendJson(res, 400, { success: false, message: 'subject_end_times must be HH:MM or HH:MM:SS', data: null });
      }
      if (hasSt && hasEn && String(en).trim() <= String(st).trim()) {
        return sendJson(res, 400, { success: false, message: 'Each subject: end_time must be greater than start_time', data: null });
      }
    }
  }

  // Legacy top-level times (optional; used only when subject time arrays omitted)
  const hasStart = b.start_time !== undefined && b.start_time !== null && String(b.start_time).trim() !== '';
  const hasEnd = b.end_time !== undefined && b.end_time !== null && String(b.end_time).trim() !== '';
  if (!starts && !ends && (hasStart || hasEnd)) {
    if (hasStart && !isTimeString(b.start_time)) {
      return sendJson(res, 400, { success: false, message: 'start_time must be HH:MM or HH:MM:SS', data: null });
    }
    if (hasEnd && !isTimeString(b.end_time)) {
      return sendJson(res, 400, { success: false, message: 'end_time must be HH:MM or HH:MM:SS', data: null });
    }
    if (hasStart && hasEnd && String(b.end_time).trim() <= String(b.start_time).trim()) {
      return sendJson(res, 400, { success: false, message: 'end_time must be greater than start_time', data: null });
    }
  }
  if (!hasSubjMax) {
    const max = Number(b.max_marks);
    if (!Number.isFinite(max) || max <= 0) {
      return sendJson(res, 400, { success: false, message: 'max_marks must be > 0', data: null });
    }
    if (b.passing_marks !== undefined && b.passing_marks !== null && b.passing_marks !== '') {
      const pass = Number(b.passing_marks);
      if (!Number.isFinite(pass) || pass < 0) {
        return sendJson(res, 400, { success: false, message: 'passing_marks must be >= 0', data: null });
      }
      if (pass > max) {
        return sendJson(res, 400, { success: false, message: 'passing_marks must be <= max_marks', data: null });
      }
    }
  }
  if (b.invigilator !== undefined && b.invigilator !== null && String(b.invigilator).trim() !== '') {
    if (String(b.invigilator).trim().length > 150) {
      return sendJson(res, 400, { success: false, message: 'invigilator must be max 150 characters', data: null });
    }
  }
  next();
}

export function validateUpdateExamination(req, res, next) {
  const b = req.body ?? {};

  if (b.exam_status !== undefined && b.exam_status !== null && !STATUS.includes(String(b.exam_status))) {
    return sendJson(res, 400, { success: false, message: 'Invalid exam_status', data: null });
  }
  if (b.exam_type_id !== undefined && b.exam_type_id !== null && String(b.exam_type_id).trim() !== '' && !isUuid(b.exam_type_id)) {
    return sendJson(res, 400, { success: false, message: 'exam_type_id must be a valid UUID', data: null });
  }
  if (b.class_id !== undefined && b.class_id !== null && !isUuid(b.class_id)) {
    return sendJson(res, 400, { success: false, message: 'class_id must be a valid UUID', data: null });
  }
  if (b.section_id !== undefined && b.section_id !== null && String(b.section_id).trim() !== '' && !isUuid(b.section_id)) {
    return sendJson(res, 400, { success: false, message: 'section_id must be a valid UUID', data: null });
  }
  if (b.section_ids !== undefined && b.section_ids !== null) {
    if (!Array.isArray(b.section_ids) || b.section_ids.some((x) => !isUuid(x))) {
      return sendJson(res, 400, { success: false, message: 'section_ids must be an array of UUIDs', data: null });
    }
  }
  if (b.subject_ids !== undefined && b.subject_ids !== null) {
    if (!Array.isArray(b.subject_ids) || b.subject_ids.length < 1 || b.subject_ids.some((x) => !isUuid(x))) {
      return sendJson(res, 400, { success: false, message: 'subject_ids must be a non-empty array of UUIDs', data: null });
    }
  }

  if (b.part_b_subject_ids !== undefined && b.part_b_subject_ids !== null) {
    if (!Array.isArray(b.part_b_subject_ids) || b.part_b_subject_ids.some((x) => !isUuid(x))) {
      return sendJson(res, 400, { success: false, message: 'part_b_subject_ids must be an array of UUIDs', data: null });
    }
    if (Array.isArray(b.subject_ids)) {
      const partA = new Set(b.subject_ids.map(String));
      if (b.part_b_subject_ids.some((id) => partA.has(String(id)))) {
        return sendJson(res, 400, { success: false, message: 'Part B subjects must not overlap Part A subjects', data: null });
      }
    }
  }

  const updHasSubjMax = b.subject_max_marks !== undefined && b.subject_max_marks !== null;
  const updHasSubjPass = b.subject_passing_marks !== undefined && b.subject_passing_marks !== null;
  if (updHasSubjPass && !updHasSubjMax) {
    return sendJson(res, 400, { success: false, message: 'subject_max_marks is required when sending subject_passing_marks', data: null });
  }
  if (updHasSubjMax) {
    if (b.subject_ids === undefined || b.subject_ids === null) {
      return sendJson(res, 400, { success: false, message: 'subject_ids is required when sending per-subject marks', data: null });
    }
    if (!Array.isArray(b.subject_max_marks)) {
      return sendJson(res, 400, { success: false, message: 'Per-subject max marks must be an array', data: null });
    }
    if (b.subject_max_marks.length !== b.subject_ids.length) {
      return sendJson(res, 400, { success: false, message: 'Per-subject marks arrays must match subject_ids length', data: null });
    }
    if (updHasSubjPass) {
      if (!Array.isArray(b.subject_passing_marks)) {
        return sendJson(res, 400, { success: false, message: 'Per-subject passing marks must be an array', data: null });
      }
      if (b.subject_passing_marks.length !== b.subject_ids.length) {
        return sendJson(res, 400, { success: false, message: 'Per-subject marks arrays must match subject_ids length', data: null });
      }
    }
    let sumMax = 0;
    let sumPass = 0;
    let anyPass = false;
    for (let i = 0; i < b.subject_ids.length; i += 1) {
      const sm = Number(b.subject_max_marks[i]);
      if (!Number.isFinite(sm) || sm <= 0) {
        return sendJson(res, 400, { success: false, message: 'Each subject_max_marks must be > 0', data: null });
      }
      sumMax += sm;
      const rawPass = updHasSubjPass ? b.subject_passing_marks[i] : null;
      if (rawPass !== undefined && rawPass !== null && rawPass !== '') {
        const sp = Number(rawPass);
        if (!Number.isFinite(sp) || sp < 0 || sp > sm) {
          return sendJson(res, 400, { success: false, message: 'Each subject_passing_marks must be between 0 and that subject max', data: null });
        }
        sumPass += sp;
        anyPass = true;
      }
    }
    if (anyPass && sumPass > sumMax) {
      return sendJson(res, 400, { success: false, message: 'Total passing marks must be <= total max marks', data: null });
    }
  }
  if (b.exam_date !== undefined && b.exam_date !== null && b.exam_date !== '' && !isDateString(b.exam_date)) {
    return sendJson(res, 400, { success: false, message: 'exam_date must be YYYY-MM-DD', data: null });
  }
  if (b.subject_exam_dates !== undefined && b.subject_exam_dates !== null) {
    if (!Array.isArray(b.subject_ids) || !Array.isArray(b.subject_exam_dates) || b.subject_exam_dates.length !== b.subject_ids.length) {
      return sendJson(res, 400, { success: false, message: 'subject_exam_dates must match subject_ids length', data: null });
    }
    for (let i = 0; i < b.subject_exam_dates.length; i += 1) {
      if (!isDateString(b.subject_exam_dates[i])) {
        return sendJson(res, 400, { success: false, message: 'Each subject_exam_dates entry must be YYYY-MM-DD', data: null });
      }
    }
  }
  if (b.subject_start_times !== undefined && b.subject_start_times !== null) {
    if (!Array.isArray(b.subject_ids) || !Array.isArray(b.subject_start_times) || b.subject_start_times.length !== b.subject_ids.length) {
      return sendJson(res, 400, { success: false, message: 'subject_start_times must match subject_ids length', data: null });
    }
  }
  if (b.subject_end_times !== undefined && b.subject_end_times !== null) {
    if (!Array.isArray(b.subject_ids) || !Array.isArray(b.subject_end_times) || b.subject_end_times.length !== b.subject_ids.length) {
      return sendJson(res, 400, { success: false, message: 'subject_end_times must match subject_ids length', data: null });
    }
  }
  if (b.start_time !== undefined && b.start_time !== null && b.start_time !== '' && !isTimeString(b.start_time)) {
    return sendJson(res, 400, { success: false, message: 'start_time must be HH:MM or HH:MM:SS', data: null });
  }
  if (b.end_time !== undefined && b.end_time !== null && b.end_time !== '' && !isTimeString(b.end_time)) {
    return sendJson(res, 400, { success: false, message: 'end_time must be HH:MM or HH:MM:SS', data: null });
  }
  if (b.max_marks !== undefined && b.max_marks !== null && b.max_marks !== '') {
    const max = Number(b.max_marks);
    if (!Number.isFinite(max) || max <= 0) return sendJson(res, 400, { success: false, message: 'max_marks must be > 0', data: null });
  }
  if (b.passing_marks !== undefined && b.passing_marks !== null && b.passing_marks !== '') {
    const pass = Number(b.passing_marks);
    if (!Number.isFinite(pass) || pass < 0) return sendJson(res, 400, { success: false, message: 'passing_marks must be >= 0', data: null });
  }
  next();
}

