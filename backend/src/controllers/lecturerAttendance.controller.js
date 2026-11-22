import { sendJson } from '../utils/apiResponse.js';
import { MESSAGES } from '../constants/messages.js';
import * as lecturerAttendanceService from '../services/lecturerAttendance.service.js';
import { actorId } from '../utils/params.js';

export async function getDayContext(req, res) {
  try {
    const result = await lecturerAttendanceService.getAttendanceDayContext({
      classId: req.query.classId,
      sectionId: req.query.sectionId ?? null,
      date: req.query.date,
    });
    return sendJson(res, result.statusCode, { success: result.success, message: result.message, data: result.data });
  } catch (err) {
    console.error('getDayContext', err);
    return sendJson(res, 500, { success: false, message: MESSAGES.common.internalServerError, data: null });
  }
}

export async function getRoster(req, res) {
  try {
    const result = await lecturerAttendanceService.getAttendanceRoster({
      classId: req.query.classId,
      sectionId: req.query.sectionId ?? null,
      date: req.query.date,
      slotIndex: req.query.slotIndex,
      search: req.query.search ?? null,
    });
    return sendJson(res, result.statusCode, { success: result.success, message: result.message, data: result.data });
  } catch (err) {
    console.error('getRoster', err);
    return sendJson(res, 500, { success: false, message: MESSAGES.common.internalServerError, data: null });
  }
}

export async function bulkMarkAbsent(req, res) {
  try {
    const userId = actorId(req);
    if (!userId) return sendJson(res, 401, { success: false, message: MESSAGES.common.unauthorized, data: null });
    const b = req.body ?? {};
    const result = await lecturerAttendanceService.bulkMarkAbsent({
      studentIds: b.student_ids,
      absentDate: b.absent_date,
      slotIndex: b.slot_index,
      reason: b.reason ?? null,
      actorUserId: userId,
      classId: b.class_id,
      sectionId: b.section_id ?? null,
    });
    return sendJson(res, result.statusCode, { success: result.success, message: result.message, data: result.data });
  } catch (err) {
    console.error('bulkMarkAbsent', err);
    return sendJson(res, 500, { success: false, message: MESSAGES.common.internalServerError, data: null });
  }
}

export async function bulkUnmarkAbsent(req, res) {
  try {
    const userId = actorId(req);
    if (!userId) return sendJson(res, 401, { success: false, message: MESSAGES.common.unauthorized, data: null });
    const b = req.body ?? {};
    const result = await lecturerAttendanceService.bulkUnmarkAbsent({
      studentIds: b.student_ids,
      absentDate: b.absent_date,
      slotIndex: b.slot_index,
      classId: b.class_id,
      sectionId: b.section_id ?? null,
    });
    return sendJson(res, result.statusCode, { success: result.success, message: result.message, data: result.data });
  } catch (err) {
    console.error('bulkUnmarkAbsent', err);
    return sendJson(res, 500, { success: false, message: MESSAGES.common.internalServerError, data: null });
  }
}

export async function cancelSlot(req, res) {
  try {
    const userId = actorId(req);
    if (!userId) return sendJson(res, 401, { success: false, message: MESSAGES.common.unauthorized, data: null });
    const b = req.body ?? {};
    const result = await lecturerAttendanceService.cancelSlot({
      date: b.date,
      slotIndex: b.slot_index,
      classId: b.class_id,
      sectionId: b.section_id ?? null,
      reason: b.reason ?? null,
      actorUserId: userId,
    });
    return sendJson(res, result.statusCode, { success: result.success, message: result.message, data: result.data });
  } catch (err) {
    console.error('cancelSlot', err);
    return sendJson(res, 500, { success: false, message: MESSAGES.common.internalServerError, data: null });
  }
}

export async function uncancelSlot(req, res) {
  try {
    const userId = actorId(req);
    if (!userId) return sendJson(res, 401, { success: false, message: MESSAGES.common.unauthorized, data: null });
    const b = req.body ?? {};
    const result = await lecturerAttendanceService.uncancelSlot({
      date: b.date,
      slotIndex: b.slot_index,
      classId: b.class_id,
      sectionId: b.section_id ?? null,
    });
    return sendJson(res, result.statusCode, { success: result.success, message: result.message, data: result.data });
  } catch (err) {
    console.error('uncancelSlot', err);
    return sendJson(res, 500, { success: false, message: MESSAGES.common.internalServerError, data: null });
  }
}
