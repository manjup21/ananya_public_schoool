import { sendJson } from '../utils/apiResponse.js';
import { MESSAGES } from '../constants/messages.js';
import * as schoolHolidaysService from '../services/schoolHolidays.service.js';
import { actorId } from '../utils/params.js';

export async function listSchoolHolidays(req, res) {
  try {
    const result = await schoolHolidaysService.listSchoolHolidays({
      search: req.query?.search ?? null,
      from: req.query?.from ?? null,
      to: req.query?.to ?? null,
      isActive: req.query?.isActive ?? null,
    });
    return sendJson(res, result.statusCode, { success: result.success, message: result.message, data: result.data });
  } catch (err) {
    console.error('listSchoolHolidays', err);
    return sendJson(res, 500, { success: false, message: MESSAGES.common.internalServerError, data: null });
  }
}

export async function createSchoolHoliday(req, res) {
  try {
    const userId = actorId(req);
    if (!userId) return sendJson(res, 401, { success: false, message: MESSAGES.common.unauthorized, data: null });
    const result = await schoolHolidaysService.createSchoolHoliday(req.body ?? {}, userId);
    return sendJson(res, result.statusCode, { success: result.success, message: result.message, data: result.data });
  } catch (err) {
    console.error('createSchoolHoliday', err);
    return sendJson(res, 500, { success: false, message: MESSAGES.common.internalServerError, data: null });
  }
}

export async function updateSchoolHoliday(req, res) {
  try {
    const userId = actorId(req);
    if (!userId) return sendJson(res, 401, { success: false, message: MESSAGES.common.unauthorized, data: null });
    const result = await schoolHolidaysService.updateSchoolHoliday(req.params.id, req.body ?? {}, userId);
    return sendJson(res, result.statusCode, { success: result.success, message: result.message, data: result.data });
  } catch (err) {
    console.error('updateSchoolHoliday', err);
    return sendJson(res, 500, { success: false, message: MESSAGES.common.internalServerError, data: null });
  }
}

export async function deleteSchoolHoliday(req, res) {
  try {
    const result = await schoolHolidaysService.deleteSchoolHoliday(req.params.id);
    return sendJson(res, result.statusCode, { success: result.success, message: result.message, data: result.data });
  } catch (err) {
    console.error('deleteSchoolHoliday', err);
    return sendJson(res, 500, { success: false, message: MESSAGES.common.internalServerError, data: null });
  }
}
