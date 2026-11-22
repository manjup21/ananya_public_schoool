import { BULK_STUDENT_REPORT_MAX } from '../services/lecturerStudents.service.js';
import { isIsoDate, isRfcUuid as isUuid } from '../utils/validators.js';

export function validateLecturerStudentsListQuery(req, res, next) {
  const classId = req.query.classId;
  if (classId != null && String(classId).trim() !== '' && !isUuid(String(classId))) {
    return res.status(400).json({ success: false, message: 'classId must be a valid UUID when provided', data: null });
  }
  const sec = req.query.sectionId;
  if (sec != null && String(sec).trim() !== '' && !isUuid(String(sec))) {
    return res.status(400).json({ success: false, message: 'sectionId must be a valid UUID when provided', data: null });
  }
  const search = req.query.search;
  const hasClass = classId != null && String(classId).trim() !== '';
  const hasSearch = search != null && String(search).trim() !== '';
  if (!hasClass && !hasSearch) {
    return res.status(400).json({ success: false, message: 'Provide classId or search to list students', data: null });
  }
  next();
}

export function validateStudentIdParam(req, res, next) {
  const { id } = req.params ?? {};
  if (!isUuid(String(id ?? ''))) {
    return res.status(400).json({ success: false, message: 'Valid student id (UUID) is required', data: null });
  }
  next();
}

export function validateAttendanceSummaryQuery(req, res, next) {
  const { from, to } = req.query ?? {};
  if (!isIsoDate(String(from ?? '')) || !isIsoDate(String(to ?? ''))) {
    return res.status(400).json({ success: false, message: 'from and to must be YYYY-MM-DD', data: null });
  }
  next();
}

export function validateExamSummaryQuery(req, res, next) {
  const { limit, offset } = req.query ?? {};
  if (limit != null && String(limit).trim() !== '') {
    const n = Number(limit);
    if (!Number.isInteger(n) || n < 1 || n > 200) {
      return res.status(400).json({ success: false, message: 'limit must be an integer between 1 and 200', data: null });
    }
  }
  if (offset != null && String(offset).trim() !== '') {
    const n = Number(offset);
    if (!Number.isInteger(n) || n < 0) {
      return res.status(400).json({ success: false, message: 'offset must be an integer >= 0', data: null });
    }
  }
  next();
}

export function validateProgressReportQuery(req, res, next) {
  const { from, to, examTypeId } = req.query ?? {};
  const hasFrom = from != null && String(from).trim() !== '';
  const hasTo = to != null && String(to).trim() !== '';
  if (hasFrom && !isIsoDate(String(from).trim())) {
    return res.status(400).json({ success: false, message: 'from must be YYYY-MM-DD when provided', data: null });
  }
  if (hasTo && !isIsoDate(String(to).trim())) {
    return res.status(400).json({ success: false, message: 'to must be YYYY-MM-DD when provided', data: null });
  }
  if (hasFrom && hasTo && String(from) > String(to)) {
    return res.status(400).json({ success: false, message: 'from date must be on or before to date', data: null });
  }
  if (examTypeId != null && String(examTypeId).trim() !== '' && !isUuid(String(examTypeId))) {
    return res.status(400).json({ success: false, message: 'examTypeId must be a valid UUID when provided', data: null });
  }
  next();
}

export function validateBulkProgressReportBody(req, res, next) {
  const studentIds = req.body?.studentIds;
  if (!Array.isArray(studentIds) || studentIds.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'studentIds must be a non-empty array of UUIDs',
      data: null,
    });
  }
  if (studentIds.length > BULK_STUDENT_REPORT_MAX) {
    return res.status(400).json({
      success: false,
      message: `At most ${BULK_STUDENT_REPORT_MAX} students per bulk request`,
      data: null,
    });
  }
  for (let i = 0; i < studentIds.length; i += 1) {
    if (!isUuid(String(studentIds[i] ?? ''))) {
      return res.status(400).json({
        success: false,
        message: `studentIds[${i}] must be a valid UUID`,
        data: null,
      });
    }
  }

  const { from, to, examTypeId } = req.body ?? {};
  const hasFrom = from != null && String(from).trim() !== '';
  const hasTo = to != null && String(to).trim() !== '';
  if (hasFrom && !isIsoDate(String(from).trim())) {
    return res.status(400).json({ success: false, message: 'from must be YYYY-MM-DD when provided', data: null });
  }
  if (hasTo && !isIsoDate(String(to).trim())) {
    return res.status(400).json({ success: false, message: 'to must be YYYY-MM-DD when provided', data: null });
  }
  if (hasFrom && hasTo && String(from) > String(to)) {
    return res.status(400).json({ success: false, message: 'from date must be on or before to date', data: null });
  }
  if (examTypeId != null && String(examTypeId).trim() !== '' && !isUuid(String(examTypeId))) {
    return res.status(400).json({
      success: false,
      message: 'examTypeId must be a valid UUID when provided',
      data: null,
    });
  }
  next();
}

