import { sendJson } from '../utils/apiResponse.js';
import { MESSAGES } from '../constants/messages.js';
import * as feeService from '../services/fee.service.js';
import { actorId } from '../utils/params.js';

export async function assignFee(req, res) {
  try {
    const userId = actorId(req);
    if (!userId) return sendJson(res, 401, { success: false, message: MESSAGES.common.unauthorized, data: null });
    const result = await feeService.assignStudentFee(req.body, userId);
    return sendJson(res, result.statusCode, { success: result.success, message: result.message, data: result.data });
  } catch (err) {
    console.error('assignFee', err);
    return sendJson(res, 500, { success: false, message: MESSAGES.common.internalServerError, data: null });
  }
}

export async function bulkAssignFee(req, res) {
  try {
    const userId = actorId(req);
    if (!userId) return sendJson(res, 401, { success: false, message: MESSAGES.common.unauthorized, data: null });
    const result = await feeService.bulkAssignFee(req.body, userId);
    return sendJson(res, result.statusCode, { success: result.success, message: result.message, data: result.data });
  } catch (err) {
    console.error('bulkAssignFee', err);
    return sendJson(res, 500, { success: false, message: MESSAGES.common.internalServerError, data: null });
  }
}

export async function recordPayment(req, res) {
  try {
    const userId = actorId(req);
    if (!userId) return sendJson(res, 401, { success: false, message: MESSAGES.common.unauthorized, data: null });
    const result = await feeService.recordFeePayment(req.body, userId);
    return sendJson(res, result.statusCode, { success: result.success, message: result.message, data: result.data });
  } catch (err) {
    console.error('recordPayment', err);
    return sendJson(res, 500, { success: false, message: MESSAGES.common.internalServerError, data: null });
  }
}

export async function listStudentFees(req, res) {
  try {
    const q = req.query ?? {};
    const result = await feeService.listStudentFees({
      academicYear: q.academic_year,
      search: q.search,
      classId: q.class_id,
      sectionId: q.section_id,
      page: q.page,
      limit: q.limit,
    });
    return sendJson(res, result.statusCode, { success: result.success, message: result.message, data: result.data });
  } catch (err) {
    console.error('listStudentFees', err);
    return sendJson(res, 500, { success: false, message: MESSAGES.common.internalServerError, data: null });
  }
}

export async function getStudentFee(req, res) {
  try {
    const result = await feeService.getStudentFee(req.params.studentId, req.query?.academic_year);
    return sendJson(res, result.statusCode, { success: result.success, message: result.message, data: result.data });
  } catch (err) {
    console.error('getStudentFee', err);
    return sendJson(res, 500, { success: false, message: MESSAGES.common.internalServerError, data: null });
  }
}

export async function getPaymentHistory(req, res) {
  try {
    const studentId = req.params.studentId;
    const q = req.query ?? {};

    const feeResult = await feeService.getStudentFee(studentId, q.academic_year);
    if (!feeResult.success) {
      return sendJson(res, feeResult.statusCode, { success: false, message: feeResult.message, data: null });
    }

    const fees = feeResult.data?.fees;
    if (!Array.isArray(fees) || fees.length === 0) {
      return sendJson(res, 404, { success: false, message: MESSAGES.fee.noRecordsFound, data: null });
    }

    const studentFeeId = fees[0].id;
    const result = await feeService.getPaymentHistory(studentFeeId, {
      page: q.page,
      limit: q.limit,
    });
    return sendJson(res, result.statusCode, { success: result.success, message: result.message, data: result.data });
  } catch (err) {
    console.error('getPaymentHistory', err);
    return sendJson(res, 500, { success: false, message: MESSAGES.common.internalServerError, data: null });
  }
}

export async function deletePayment(req, res) {
  try {
    const result = await feeService.deletePayment(req.params.paymentId);
    return sendJson(res, result.statusCode, { success: result.success, message: result.message, data: result.data });
  } catch (err) {
    console.error('deletePayment', err);
    return sendJson(res, 500, { success: false, message: MESSAGES.common.internalServerError, data: null });
  }
}

export async function deleteFeeItem(req, res) {
  try {
    const result = await feeService.deleteFeeItem(req.params.itemId);
    return sendJson(res, result.statusCode, { success: result.success, message: result.message, data: result.data });
  } catch (err) {
    console.error('deleteFeeItem', err);
    return sendJson(res, 500, { success: false, message: MESSAGES.common.internalServerError, data: null });
  }
}

export async function getDashboardSummary(req, res) {
  try {
    const q = req.query ?? {};
    const result = await feeService.getFeeDashboardSummary({
      academicYear: q.academic_year,
      classId: q.class_id,
      sectionId: q.section_id,
    });
    return sendJson(res, result.statusCode, { success: result.success, message: result.message, data: result.data });
  } catch (err) {
    console.error('getDashboardSummary', err);
    return sendJson(res, 500, { success: false, message: MESSAGES.common.internalServerError, data: null });
  }
}
