import { sendJson } from '../utils/apiResponse.js';
import { MESSAGES } from '../constants/messages.js';
import * as lecturerAccountService from '../services/lecturerAccount.service.js';

export async function getProfile(req, res) {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      return sendJson(res, 401, { success: false, message: MESSAGES.common.unauthorized, data: null });
    }
    const result = await lecturerAccountService.getLecturerProfileByUserId(userId);
    return sendJson(res, result.statusCode, {
      success: result.success,
      message: result.message,
      data: result.data,
    });
  } catch (err) {
    console.error('lecturerAccount:getProfile', err);
    return sendJson(res, 500, { success: false, message: MESSAGES.common.internalServerError, data: null });
  }
}
