import { isIsoDate, isRfcUuid as isUuid } from '../utils/validators.js';

export function validateDayContextQuery(req, res, next) {
  const { classId, date } = req.query ?? {};
  if (!isUuid(String(classId ?? ''))) {
    return res.status(400).json({ success: false, message: 'classId must be a valid UUID', data: null });
  }
  if (!isIsoDate(String(date ?? ''))) {
    return res.status(400).json({ success: false, message: 'date must be YYYY-MM-DD', data: null });
  }
  const sec = req.query.sectionId;
  if (sec != null && String(sec).trim() !== '' && !isUuid(String(sec))) {
    return res.status(400).json({ success: false, message: 'sectionId must be a valid UUID when provided', data: null });
  }
  next();
}

export function validateRosterQuery(req, res, next) {
  const { classId, date, slotIndex } = req.query ?? {};
  if (!isUuid(String(classId ?? ''))) {
    return res.status(400).json({ success: false, message: 'classId must be a valid UUID', data: null });
  }
  if (!isIsoDate(String(date ?? ''))) {
    return res.status(400).json({ success: false, message: 'date must be YYYY-MM-DD', data: null });
  }
  const slot = Number(slotIndex);
  if (!Number.isInteger(slot) || slot < 1 || slot > 10) {
    return res.status(400).json({ success: false, message: 'slotIndex must be an integer between 1 and 10', data: null });
  }
  const sec = req.query.sectionId;
  if (sec != null && String(sec).trim() !== '' && !isUuid(String(sec))) {
    return res.status(400).json({ success: false, message: 'sectionId must be a valid UUID when provided', data: null });
  }
  next();
}

export function validateBulkMarkAbsent(req, res, next) {
  const b = req.body ?? {};
  if (!isUuid(String(b.class_id ?? ''))) {
    return res.status(400).json({ success: false, message: 'class_id must be a valid UUID', data: null });
  }
  if (!isIsoDate(String(b.absent_date ?? ''))) {
    return res.status(400).json({ success: false, message: 'absent_date must be YYYY-MM-DD', data: null });
  }
  const slot = Number(b.slot_index);
  if (!Number.isInteger(slot) || slot < 1 || slot > 10) {
    return res.status(400).json({ success: false, message: 'slot_index must be an integer between 1 and 10', data: null });
  }
  const ids = b.student_ids;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ success: false, message: 'student_ids must be a non-empty array', data: null });
  }
  if (ids.length > 500) {
    return res.status(400).json({ success: false, message: 'student_ids cannot exceed 500 entries', data: null });
  }
  for (const id of ids) {
    if (!isUuid(String(id ?? ''))) {
      return res.status(400).json({ success: false, message: 'Each student_ids entry must be a valid UUID', data: null });
    }
  }
  const sec = b.section_id;
  if (sec != null && String(sec).trim() !== '' && !isUuid(String(sec))) {
    return res.status(400).json({ success: false, message: 'section_id must be a valid UUID when provided', data: null });
  }
  next();
}

export function validateCancelSlot(req, res, next) {
  const b = req.body ?? {};
  if (!isUuid(String(b.class_id ?? ''))) {
    return res.status(400).json({ success: false, message: 'class_id must be a valid UUID', data: null });
  }
  if (!isIsoDate(String(b.date ?? ''))) {
    return res.status(400).json({ success: false, message: 'date must be YYYY-MM-DD', data: null });
  }
  const slot = Number(b.slot_index);
  if (!Number.isInteger(slot) || slot < 1 || slot > 10) {
    return res.status(400).json({ success: false, message: 'slot_index must be an integer between 1 and 10', data: null });
  }
  const sec = b.section_id;
  if (sec != null && String(sec).trim() !== '' && !isUuid(String(sec))) {
    return res.status(400).json({ success: false, message: 'section_id must be a valid UUID when provided', data: null });
  }
  next();
}
