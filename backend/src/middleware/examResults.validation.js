import { sendJson } from '../utils/apiResponse.js';
import { isUuid } from '../utils/validators.js';

function missing(v) {
  if (v === undefined || v === null) return true;
  if (typeof v === 'string' && v.trim() === '') return true;
  return false;
}

function validatePartBFields(payload, res) {
  const hasPartBIds = payload.part_b_subject_ids !== undefined && payload.part_b_subject_ids !== null;
  const hasPartBGrades = payload.part_b_grades !== undefined && payload.part_b_grades !== null;
  if (!hasPartBIds && !hasPartBGrades) return null;

  if (!hasPartBIds || !Array.isArray(payload.part_b_subject_ids) || payload.part_b_subject_ids.some((x) => !isUuid(x))) {
    return sendJson(res, 400, {
      success: false,
      message: 'part_b_subject_ids must be an array of UUIDs when Part B grades are sent',
      data: null,
    });
  }
  if (!hasPartBGrades || !Array.isArray(payload.part_b_grades) || payload.part_b_grades.length !== payload.part_b_subject_ids.length) {
    return sendJson(res, 400, {
      success: false,
      message: 'part_b_grades must match part_b_subject_ids length (use empty string to skip)',
      data: null,
    });
  }
  for (let i = 0; i < payload.part_b_grades.length; i += 1) {
    const g = payload.part_b_grades[i];
    if (g == null) continue;
    const s = String(g);
    if (s.length > 50) {
      return sendJson(res, 400, {
        success: false,
        message: `part_b_grades[${i}] is invalid`,
        data: null,
      });
    }
  }
  return null;
}

export function validateStudentIdParam(req, res, next) {
  const { studentId } = req.params;
  if (!studentId || !isUuid(studentId)) {
    return sendJson(res, 400, { success: false, message: 'Valid studentId (UUID) is required', data: null });
  }
  next();
}

export function validateSaveStudentResult(req, res, next) {
  const b = req.body ?? {};
  if (missing(b.student_id) || !isUuid(b.student_id)) {
    return sendJson(res, 400, { success: false, message: 'student_id (UUID) is required', data: null });
  }

  const hasPartA = Array.isArray(b.subject_ids) && b.subject_ids.length > 0;
  const hasPartB = Array.isArray(b.part_b_subject_ids) && b.part_b_subject_ids.length > 0;
  if (!hasPartA && !hasPartB) {
    return sendJson(res, 400, {
      success: false,
      message: 'Provide subject_ids (Part A) and/or part_b_subject_ids (Part B)',
      data: null,
    });
  }

  if (hasPartA) {
    if (b.subject_ids.some((x) => !isUuid(x))) {
      return sendJson(res, 400, { success: false, message: 'subject_ids must be an array of UUIDs', data: null });
    }
    if (b.marks !== undefined && b.marks !== null) {
      if (!Array.isArray(b.marks) || b.marks.length !== b.subject_ids.length) {
        return sendJson(res, 400, {
          success: false,
          message: 'marks must be an array matching subject_ids length (use null for empty)',
          data: null,
        });
      }
    }
    if (b.is_absent !== undefined && b.is_absent !== null) {
      if (!Array.isArray(b.is_absent) || b.is_absent.length !== b.subject_ids.length) {
        return sendJson(res, 400, {
          success: false,
          message: 'is_absent must be an array matching subject_ids length',
          data: null,
        });
      }
    }
    if (b.remarks !== undefined && b.remarks !== null) {
      if (!Array.isArray(b.remarks) || b.remarks.length !== b.subject_ids.length) {
        return sendJson(res, 400, {
          success: false,
          message: 'remarks must be an array matching subject_ids length',
          data: null,
        });
      }
    }
  }

  const partBErr = validatePartBFields(b, res);
  if (partBErr) return partBErr;
  next();
}

export function validateBulkSave(req, res, next) {
  const b = req.body ?? {};
  if (!Array.isArray(b.rows) || b.rows.length < 1) {
    return sendJson(res, 400, { success: false, message: 'rows must be a non-empty array', data: null });
  }
  for (const r of b.rows) {
    if (missing(r?.student_id) || !isUuid(r.student_id)) {
      return sendJson(res, 400, { success: false, message: 'Each row must include student_id (UUID)', data: null });
    }
    const hasPartA = Array.isArray(r.subject_ids) && r.subject_ids.length > 0;
    const hasPartB = Array.isArray(r.part_b_subject_ids) && r.part_b_subject_ids.length > 0;
    if (!hasPartA && !hasPartB) {
      return sendJson(res, 400, {
        success: false,
        message: 'Each row must include subject_ids and/or part_b_subject_ids',
        data: null,
      });
    }
    if (hasPartA) {
      if (r.subject_ids.some((x) => !isUuid(x))) {
        return sendJson(res, 400, { success: false, message: 'subject_ids must be UUID[]', data: null });
      }
      if (!Array.isArray(r.marks) || r.marks.length !== r.subject_ids.length) {
        return sendJson(res, 400, {
          success: false,
          message: 'Each row must include marks[] matching subject_ids length (use null for empty)',
          data: null,
        });
      }
      if (!Array.isArray(r.is_absent) || r.is_absent.length !== r.subject_ids.length) {
        return sendJson(res, 400, {
          success: false,
          message: 'Each row must include is_absent[] matching subject_ids length',
          data: null,
        });
      }
      if (r.remarks != null && (!Array.isArray(r.remarks) || r.remarks.length !== r.subject_ids.length)) {
        return sendJson(res, 400, {
          success: false,
          message: 'If provided, remarks[] must match subject_ids length',
          data: null,
        });
      }
    }
    const partBErr = validatePartBFields(r, res);
    if (partBErr) return partBErr;
  }
  next();
}
