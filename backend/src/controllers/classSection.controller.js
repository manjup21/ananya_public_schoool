import { sendJson } from '../utils/apiResponse.js';
import { MESSAGES } from '../constants/messages.js';
import * as classSectionService from '../services/classSection.service.js';
import { actorId } from '../utils/params.js';

export async function getClasses(req, res) {
  try {
    const result = await classSectionService.getClasses();
    return sendJson(res, result.statusCode, {
      success: result.success,
      message: result.message,
      data: result.data,
    });
  } catch (err) {
    console.error('getClasses', err);
    return sendJson(res, 500, { success: false, message: MESSAGES.common.internalServerError, data: null });
  }
}

export async function createClass(req, res) {
  try {
    const userId = actorId(req);
    if (!userId) {
      return sendJson(res, 401, { success: false, message: MESSAGES.common.unauthorized, data: null });
    }
    const result = await classSectionService.createClass(req.body.name, userId);
    return sendJson(res, result.statusCode, {
      success: result.success,
      message: result.message,
      data: result.data,
    });
  } catch (err) {
    console.error('createClass', err);
    return sendJson(res, 500, { success: false, message: MESSAGES.common.internalServerError, data: null });
  }
}

export async function updateClass(req, res) {
  try {
    const userId = actorId(req);
    if (!userId) {
      return sendJson(res, 401, { success: false, message: MESSAGES.common.unauthorized, data: null });
    }
    const result = await classSectionService.updateClass(req.params.classId, req.body.name, userId);
    return sendJson(res, result.statusCode, {
      success: result.success,
      message: result.message,
      data: result.data,
    });
  } catch (err) {
    console.error('updateClass', err);
    return sendJson(res, 500, { success: false, message: MESSAGES.common.internalServerError, data: null });
  }
}

export async function deleteClass(req, res) {
  try {
    const result = await classSectionService.deleteClass(req.params.classId);
    return sendJson(res, result.statusCode, {
      success: result.success,
      message: result.message,
      data: result.data,
    });
  } catch (err) {
    console.error('deleteClass', err);
    return sendJson(res, 500, { success: false, message: MESSAGES.common.internalServerError, data: null });
  }
}

export async function createSection(req, res) {
  try {
    const userId = actorId(req);
    if (!userId) {
      return sendJson(res, 401, { success: false, message: MESSAGES.common.unauthorized, data: null });
    }
    const result = await classSectionService.createSection(
      req.params.classId,
      req.body.section_code,
      userId
    );
    return sendJson(res, result.statusCode, {
      success: result.success,
      message: result.message,
      data: result.data,
    });
  } catch (err) {
    console.error('createSection', err);
    return sendJson(res, 500, { success: false, message: MESSAGES.common.internalServerError, data: null });
  }
}

export async function updateSection(req, res) {
  try {
    const userId = actorId(req);
    if (!userId) {
      return sendJson(res, 401, { success: false, message: MESSAGES.common.unauthorized, data: null });
    }
    const result = await classSectionService.updateSection(
      req.params.sectionId,
      req.body.section_code,
      userId
    );
    return sendJson(res, result.statusCode, {
      success: result.success,
      message: result.message,
      data: result.data,
    });
  } catch (err) {
    console.error('updateSection', err);
    return sendJson(res, 500, { success: false, message: MESSAGES.common.internalServerError, data: null });
  }
}

export async function deleteSection(req, res) {
  try {
    const result = await classSectionService.deleteSection(req.params.sectionId);
    return sendJson(res, result.statusCode, {
      success: result.success,
      message: result.message,
      data: result.data,
    });
  } catch (err) {
    console.error('deleteSection', err);
    return sendJson(res, 500, { success: false, message: MESSAGES.common.internalServerError, data: null });
  }
}
