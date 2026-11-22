import { sendJson } from '../utils/apiResponse.js';
import { UUID_REGEX } from '../utils/validators.js';

const ACADEMIC_YEAR_REGEX = /^\d{4}-\d{4}$/;
const VALID_PAYMENT_METHODS = new Set([
  'cash', 'cheque', 'bank_transfer', 'upi', 'online', 'other',
]);

function missing(v) {
  if (v === undefined || v === null) return true;
  if (typeof v === 'string' && v.trim() === '') return true;
  return false;
}

export function validateStudentIdParam(req, res, next) {
  const { studentId } = req.params;
  if (!studentId || !UUID_REGEX.test(studentId)) {
    return sendJson(res, 400, { success: false, message: 'Valid student id (UUID) is required', data: null });
  }
  next();
}

export function validatePaymentIdParam(req, res, next) {
  const { paymentId } = req.params;
  if (!paymentId || !UUID_REGEX.test(paymentId)) {
    return sendJson(res, 400, { success: false, message: 'Valid payment id (UUID) is required', data: null });
  }
  next();
}

export function validateFeeItemIdParam(req, res, next) {
  const { itemId } = req.params;
  if (!itemId || !UUID_REGEX.test(itemId)) {
    return sendJson(res, 400, { success: false, message: 'Valid fee item id (UUID) is required', data: null });
  }
  next();
}

export function validateAssignFee(req, res, next) {
  const b = req.body ?? {};
  if (missing(b.student_id) || !UUID_REGEX.test(b.student_id)) {
    return sendJson(res, 400, { success: false, message: 'Valid student_id (UUID) is required', data: null });
  }
  if (missing(b.academic_year) || !ACADEMIC_YEAR_REGEX.test(String(b.academic_year).trim())) {
    return sendJson(res, 400, { success: false, message: 'academic_year is required (format: YYYY-YYYY)', data: null });
  }
  const [startY, endY] = String(b.academic_year).trim().split('-').map(Number);
  if (endY !== startY + 1) {
    return sendJson(res, 400, { success: false, message: 'academic_year must be consecutive years (e.g. 2025-2026)', data: null });
  }
  const totalFee = Number(b.total_fee);
  if (missing(b.total_fee) || !Number.isFinite(totalFee) || totalFee < 0) {
    return sendJson(res, 400, { success: false, message: 'total_fee must be a number >= 0', data: null });
  }
  if (b.discount !== undefined && b.discount !== null) {
    const discount = Number(b.discount);
    if (!Number.isFinite(discount) || discount < 0) {
      return sendJson(res, 400, { success: false, message: 'discount must be a number >= 0', data: null });
    }
    if (discount > totalFee) {
      return sendJson(res, 400, { success: false, message: 'discount cannot exceed total_fee', data: null });
    }
  }
  if (b.due_date !== undefined && b.due_date !== null && b.due_date !== '') {
    if (Number.isNaN(Date.parse(b.due_date))) {
      return sendJson(res, 400, { success: false, message: 'due_date must be a valid date (YYYY-MM-DD)', data: null });
    }
  }
  if (b.add_to_existing !== undefined && b.add_to_existing !== null && typeof b.add_to_existing !== 'boolean') {
    return sendJson(res, 400, { success: false, message: 'add_to_existing must be a boolean', data: null });
  }
  if (missing(b.fee_name)) {
    return sendJson(res, 400, { success: false, message: 'fee_name is required', data: null });
  }
  if (String(b.fee_name).trim().length > 120) {
    return sendJson(res, 400, { success: false, message: 'fee_name must be <= 120 characters', data: null });
  }
  next();
}

export function validateBulkAssignFee(req, res, next) {
  const b = req.body ?? {};
  if (missing(b.class_id) || !UUID_REGEX.test(b.class_id)) {
    return sendJson(res, 400, { success: false, message: 'Valid class_id (UUID) is required', data: null });
  }
  if (missing(b.academic_year) || !ACADEMIC_YEAR_REGEX.test(String(b.academic_year).trim())) {
    return sendJson(res, 400, { success: false, message: 'academic_year is required (format: YYYY-YYYY)', data: null });
  }
  const [startY, endY] = String(b.academic_year).trim().split('-').map(Number);
  if (endY !== startY + 1) {
    return sendJson(res, 400, { success: false, message: 'academic_year must be consecutive years (e.g. 2025-2026)', data: null });
  }
  const totalFee = Number(b.total_fee);
  if (missing(b.total_fee) || !Number.isFinite(totalFee) || totalFee < 0) {
    return sendJson(res, 400, { success: false, message: 'total_fee must be a number >= 0', data: null });
  }
  if (b.discount !== undefined && b.discount !== null) {
    const discount = Number(b.discount);
    if (!Number.isFinite(discount) || discount < 0) {
      return sendJson(res, 400, { success: false, message: 'discount must be a number >= 0', data: null });
    }
    if (discount > totalFee) {
      return sendJson(res, 400, { success: false, message: 'discount cannot exceed total_fee', data: null });
    }
  }
  if (b.section_id !== undefined && b.section_id !== null && b.section_id !== '') {
    if (!UUID_REGEX.test(b.section_id)) {
      return sendJson(res, 400, { success: false, message: 'section_id must be a valid UUID', data: null });
    }
  }
  if (b.due_date !== undefined && b.due_date !== null && b.due_date !== '') {
    if (Number.isNaN(Date.parse(b.due_date))) {
      return sendJson(res, 400, { success: false, message: 'due_date must be a valid date (YYYY-MM-DD)', data: null });
    }
  }
  if (b.add_to_existing !== undefined && b.add_to_existing !== null && typeof b.add_to_existing !== 'boolean') {
    return sendJson(res, 400, { success: false, message: 'add_to_existing must be a boolean', data: null });
  }
  if (missing(b.fee_name)) {
    return sendJson(res, 400, { success: false, message: 'fee_name is required', data: null });
  }
  if (String(b.fee_name).trim().length > 120) {
    return sendJson(res, 400, { success: false, message: 'fee_name must be <= 120 characters', data: null });
  }
  next();
}

export function validateRecordPayment(req, res, next) {
  const b = req.body ?? {};
  if (missing(b.student_fee_id) || !UUID_REGEX.test(b.student_fee_id)) {
    return sendJson(res, 400, { success: false, message: 'Valid student_fee_id (UUID) is required', data: null });
  }
  const amount = Number(b.amount);
  if (missing(b.amount) || !Number.isFinite(amount) || amount <= 0) {
    return sendJson(res, 400, { success: false, message: 'amount must be a number > 0', data: null });
  }
  if (missing(b.payment_date)) {
    return sendJson(res, 400, { success: false, message: 'payment_date is required', data: null });
  }
  if (Number.isNaN(Date.parse(b.payment_date))) {
    return sendJson(res, 400, { success: false, message: 'payment_date must be a valid date (YYYY-MM-DD)', data: null });
  }
  if (missing(b.payment_method) || !VALID_PAYMENT_METHODS.has(String(b.payment_method).trim())) {
    return sendJson(res, 400, {
      success: false,
      message: 'payment_method must be one of: cash, cheque, bank_transfer, upi, online, other',
      data: null,
    });
  }
  next();
}

export function validateAcademicYearQuery(req, res, next) {
  const ay = req.query?.academic_year;
  if (missing(ay) || !ACADEMIC_YEAR_REGEX.test(String(ay).trim())) {
    return sendJson(res, 400, { success: false, message: 'academic_year query param is required (format: YYYY-YYYY)', data: null });
  }
  const [startY, endY] = String(ay).trim().split('-').map(Number);
  if (endY !== startY + 1) {
    return sendJson(res, 400, { success: false, message: 'academic_year must be consecutive years (e.g. 2025-2026)', data: null });
  }
  next();
}
