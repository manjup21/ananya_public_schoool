import { sendJson } from '../utils/apiResponse.js';
import { MESSAGES } from '../constants/messages.js';
import * as dashboardService from '../services/dashboard.service.js';

export async function getAdminDashboard(req, res) {
  try {
    const result = await dashboardService.getAdminDashboard({
      from: req.query.from,
      to: req.query.to,
    });
    return sendJson(res, result.statusCode, { success: result.success, message: result.message, data: result.data });
  } catch (err) {
    console.error('dashboard:getAdminDashboard', err);
    return sendJson(res, 500, { success: false, message: MESSAGES.common.internalServerError, data: null });
  }
}

export async function getLecturerDashboard(req, res) {
  try {
    const result = await dashboardService.getLecturerDashboard({
      from: req.query.from,
      to: req.query.to,
    });
    return sendJson(res, result.statusCode, { success: result.success, message: result.message, data: result.data });
  } catch (err) {
    console.error('dashboard:getLecturerDashboard', err);
    return sendJson(res, 500, { success: false, message: MESSAGES.common.internalServerError, data: null });
  }
}

