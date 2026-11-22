import { sendJson } from '../utils/apiResponse.js';
import { MESSAGES } from '../constants/messages.js';
import * as notificationService from '../services/notification.service.js';
import { actorId } from '../utils/params.js';

// ─── Attendance ──────────────────────────────────────────────────────

export async function getAttendanceSummary(req, res) {
  try {
    const result = await notificationService.getAttendanceSummary(req.query?.date);
    return sendJson(res, result.statusCode, {
      success: result.success,
      message: result.message,
      data: result.data,
    });
  } catch (err) {
    console.error('getAttendanceSummary', err);
    return sendJson(res, 500, { success: false, message: MESSAGES.common.internalServerError, data: null });
  }
}

export async function getAttendanceDetail(req, res) {
  try {
    const result = await notificationService.getAttendanceDetail({
      classId: req.query?.classId,
      sectionId: req.query?.sectionId || null,
      date: req.query?.date,
    });
    return sendJson(res, result.statusCode, {
      success: result.success,
      message: result.message,
      data: result.data,
    });
  } catch (err) {
    console.error('getAttendanceDetail', err);
    return sendJson(res, 500, { success: false, message: MESSAGES.common.internalServerError, data: null });
  }
}

export async function sendAttendanceNotification(req, res) {
  try {
    const userId = actorId(req);
    if (!userId) {
      return sendJson(res, 401, { success: false, message: MESSAGES.common.unauthorized, data: null });
    }
    const result = await notificationService.sendAttendanceNotification({
      classId: req.body?.classId,
      sectionId: req.body?.sectionId || null,
      date: req.body?.date,
      channel: req.body?.channel,
      actorUserId: userId,
    });
    return sendJson(res, result.statusCode, {
      success: result.success,
      message: result.message,
      data: result.data,
    });
  } catch (err) {
    console.error('sendAttendanceNotification', err);
    return sendJson(res, 500, { success: false, message: MESSAGES.common.internalServerError, data: null });
  }
}

export async function sendBulkAttendanceNotification(req, res) {
  try {
    const userId = actorId(req);
    if (!userId) {
      return sendJson(res, 401, { success: false, message: MESSAGES.common.unauthorized, data: null });
    }
    const result = await notificationService.sendBulkAttendanceNotifications({
      date: req.body?.date,
      channel: req.body?.channel,
      actorUserId: userId,
    });
    return sendJson(res, result.statusCode, {
      success: result.success,
      message: result.message,
      data: result.data,
    });
  } catch (err) {
    console.error('sendBulkAttendanceNotification', err);
    return sendJson(res, 500, { success: false, message: MESSAGES.common.internalServerError, data: null });
  }
}

// ─── Examinations ────────────────────────────────────────────────────

export async function getExamNotificationList(req, res) {
  try {
    const result = await notificationService.getExamNotificationList();
    return sendJson(res, result.statusCode, {
      success: result.success,
      message: result.message,
      data: result.data,
    });
  } catch (err) {
    console.error('getExamNotificationList', err);
    return sendJson(res, 500, { success: false, message: MESSAGES.common.internalServerError, data: null });
  }
}

export async function getExamNotificationDetail(req, res) {
  try {
    const result = await notificationService.getExamNotificationDetail(req.query?.examinationId);
    return sendJson(res, result.statusCode, {
      success: result.success,
      message: result.message,
      data: result.data,
    });
  } catch (err) {
    console.error('getExamNotificationDetail', err);
    return sendJson(res, 500, { success: false, message: MESSAGES.common.internalServerError, data: null });
  }
}

export async function sendExamNotification(req, res) {
  try {
    const userId = actorId(req);
    if (!userId) {
      return sendJson(res, 401, { success: false, message: MESSAGES.common.unauthorized, data: null });
    }
    const result = await notificationService.sendExamNotification({
      examId: req.body?.examId,
      channel: req.body?.channel,
      actorUserId: userId,
    });
    return sendJson(res, result.statusCode, {
      success: result.success,
      message: result.message,
      data: result.data,
    });
  } catch (err) {
    console.error('sendExamNotification', err);
    return sendJson(res, 500, { success: false, message: MESSAGES.common.internalServerError, data: null });
  }
}

// ─── Retry Failed ────────────────────────────────────────────────────

export async function retryFailedNotifications(req, res) {
  try {
    const userId = actorId(req);
    if (!userId) {
      return sendJson(res, 401, { success: false, message: MESSAGES.common.unauthorized, data: null });
    }
    const result = await notificationService.retryFailedNotifications({
      logId: req.body?.logId,
      actorUserId: userId,
    });
    return sendJson(res, result.statusCode, {
      success: result.success,
      message: result.message,
      data: result.data,
    });
  } catch (err) {
    console.error('retryFailedNotifications', err);
    return sendJson(res, 500, { success: false, message: MESSAGES.common.internalServerError, data: null });
  }
}

// ─── Fee Due ─────────────────────────────────────────────────────────

export async function getFeeDueNotificationSummary(req, res) {
  try {
    const result = await notificationService.getFeeDueNotificationSummary(
      req.query?.academic_year || req.query?.academicYear
    );
    return sendJson(res, result.statusCode, {
      success: result.success,
      message: result.message,
      data: result.data,
    });
  } catch (err) {
    console.error('getFeeDueNotificationSummary', err);
    return sendJson(res, 500, { success: false, message: MESSAGES.common.internalServerError, data: null });
  }
}

export async function getFeeDueNotificationDetail(req, res) {
  try {
    const result = await notificationService.getFeeDueNotificationDetail({
      classId: req.query?.classId,
      sectionId: req.query?.sectionId || null,
      academicYear: req.query?.academic_year || req.query?.academicYear,
    });
    return sendJson(res, result.statusCode, {
      success: result.success,
      message: result.message,
      data: result.data,
    });
  } catch (err) {
    console.error('getFeeDueNotificationDetail', err);
    return sendJson(res, 500, { success: false, message: MESSAGES.common.internalServerError, data: null });
  }
}

export async function sendFeeDueNotification(req, res) {
  try {
    const userId = actorId(req);
    if (!userId) {
      return sendJson(res, 401, { success: false, message: MESSAGES.common.unauthorized, data: null });
    }
    const result = await notificationService.sendFeeDueNotification({
      classId: req.body?.classId,
      sectionId: req.body?.sectionId || null,
      academicYear: req.body?.academicYear || req.body?.academic_year,
      studentIds: req.body?.studentIds || req.body?.student_ids,
      dueDate: req.body?.dueDate || req.body?.due_date || null,
      channel: req.body?.channel || 'whatsapp',
      actorUserId: userId,
    });
    return sendJson(res, result.statusCode, {
      success: result.success,
      message: result.message,
      data: result.data,
    });
  } catch (err) {
    console.error('sendFeeDueNotification', err);
    return sendJson(res, 500, { success: false, message: MESSAGES.common.internalServerError, data: null });
  }
}

// ─── Logs ────────────────────────────────────────────────────────────

export async function getNotificationLogs(req, res) {
  try {
    const result = await notificationService.getNotificationLogs({
      type: req.query?.type,
      page: req.query?.page,
      limit: req.query?.limit,
    });
    return sendJson(res, result.statusCode, {
      success: result.success,
      message: result.message,
      data: result.data,
    });
  } catch (err) {
    console.error('getNotificationLogs', err);
    return sendJson(res, 500, { success: false, message: MESSAGES.common.internalServerError, data: null });
  }
}
