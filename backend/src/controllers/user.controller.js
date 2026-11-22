import { sendJson } from '../utils/apiResponse.js';
import * as userService from '../services/user.service.js';
import { MESSAGES } from '../constants/messages.js';

export async function createUser(req, res) {
  try {
    const { name, email, password, role } = req.body;
    const result = await userService.createUser({ name, email, password, role });
    return sendJson(res, result.statusCode, {
      success: result.success,
      message: result.message,
      data: result.data,
    });
  } catch (err) {
    console.error('createUser', err);
    return sendJson(res, 500, {
      success: false,
      message: MESSAGES.common.internalServerError,
      data: null,
    });
  }
}

export async function updateUser(req, res) {
  try {
    const { id } = req.params;
    const {
      name,
      email,
      password,
      role,
      can_manage_fees,
      is_super_admin,
      is_admin,
    } = req.body;
    const result = await userService.updateUser(id, {
      name,
      email,
      password,
      role,
      can_manage_fees,
      is_super_admin,
      is_admin,
    });
    return sendJson(res, result.statusCode, {
      success: result.success,
      message: result.message,
      data: result.data,
    });
  } catch (err) {
    console.error('updateUser', err);
    return sendJson(res, 500, {
      success: false,
      message: MESSAGES.common.internalServerError,
      data: null,
    });
  }
}

export async function deleteUser(req, res) {
  try {
    const { id } = req.params;
    const result = await userService.deleteUser(id);
    return sendJson(res, result.statusCode, {
      success: result.success,
      message: result.message,
      data: result.data,
    });
  } catch (err) {
    console.error('deleteUser', err);
    return sendJson(res, 500, {
      success: false,
      message: MESSAGES.common.internalServerError,
      data: null,
    });
  }
}

export async function getUsers(req, res) {
  try {
    const result = await userService.getUsers(req.validatedQuery);
    return sendJson(res, result.statusCode, {
      success: result.success,
      message: result.message,
      data: result.data,
    });
  } catch (err) {
    console.error('getUsers', err);
    return sendJson(res, 500, {
      success: false,
      message: MESSAGES.common.internalServerError,
      data: null,
    });
  }
}
