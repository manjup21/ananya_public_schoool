import { sendJson } from '../utils/apiResponse.js';
import { decryptPassword } from '../utils/encryption.js';
import { clearAuthCookie, setAuthCookie as setCookie } from '../utils/authCookie.js';
import * as authService from '../services/auth.service.js';
import { MESSAGES } from '../constants/messages.js';

const STAFF_SESSION_MS = 8 * 60 * 60 * 1000;
const setAuthCookie = (res, token) => setCookie(res, token, STAFF_SESSION_MS);

/** Sets the cookie (short-lived for password-setup sessions) and sends the result. */
function sendSession(res, result) {
  if (result.success && result.data?.token) {
    setCookie(
      res,
      result.data.token,
      result.data.user?.password_setup ? authService.PASSWORD_SETUP_SESSION_MS : STAFF_SESSION_MS
    );
  }
  return sendJson(res, result.statusCode, { success: result.success, message: result.message, data: result.data });
}

export async function login(req, res) {
  try {
    const { email, phone, employeeId, encryptedPassword } = req.body ?? {};
    if (!encryptedPassword) {
      return sendJson(res, 400, {
        success: false,
        message: MESSAGES.auth.loginCredentialsRequired,
        data: null,
      });
    }

    const emp = employeeId != null ? String(employeeId).trim() : '';
    const em = email != null ? String(email).trim() : '';
    const ph = phone != null ? String(phone).trim() : '';
    if (ph !== '' && !/^\d{10}$/.test(ph)) {
      return sendJson(res, 400, { success: false, message: MESSAGES.auth.invalidPhone, data: null });
    }

    const plainPassword = decryptPassword(encryptedPassword);
    let result;
    if (emp !== '') {
      result = await authService.loginWithLecturerEmployeeId(emp, plainPassword);
    } else if (ph !== '') {
      result = await authService.loginWithAdminPhone(ph, plainPassword);
    } else if (em !== '') {
      result = await authService.loginWithEmailPassword(em, plainPassword);
    } else {
      return sendJson(res, 400, {
        success: false,
        message: MESSAGES.auth.loginCredentialsRequired,
        data: null,
      });
    }

    return sendSession(res, result);
  } catch (err) {
    console.error('login', err);
    return sendJson(res, 500, {
      success: false,
      message: MESSAGES.common.internalServerError,
      data: null,
    });
  }
}

export async function me(req, res) {
  try {
    const userId = req.auth?.userId;
    const result = await authService.getMe(userId, { sessionRole: req.auth?.role });
    const data =
      result.success && result.data && req.auth?.password_setup === true
        ? { ...result.data, password_setup: true }
        : result.data;

    return sendJson(res, result.statusCode, {
      success: result.success,
      message: result.message,
      data,
    });
  } catch (err) {
    console.error('me', err);
    return sendJson(res, 500, {
      success: false,
      message: MESSAGES.common.internalServerError,
      data: null,
    });
  }
}

export async function switchPortal(req, res) {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      return sendJson(res, 401, { success: false, message: MESSAGES.common.unauthorized, data: null });
    }
    const result = await authService.switchPortal({
      userId,
      portal: req.body?.portal,
    });
    if (result.success && result.data?.token) {
      setAuthCookie(res, result.data.token);
    }
    return sendJson(res, result.statusCode, {
      success: result.success,
      message: result.message,
      data: result.data,
    });
  } catch (err) {
    console.error('switchPortal', err);
    return sendJson(res, 500, {
      success: false,
      message: MESSAGES.common.internalServerError,
      data: null,
    });
  }
}

export async function refreshSession(req, res) {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      return sendJson(res, 401, { success: false, message: MESSAGES.common.unauthorized, data: null });
    }
    const result = await authService.refreshSession({
      userId,
      sessionRole: req.auth?.role,
    });
    if (result.success && result.data?.token) {
      setAuthCookie(res, result.data.token);
    }
    return sendJson(res, result.statusCode, {
      success: result.success,
      message: result.message,
      data: result.data,
    });
  } catch (err) {
    console.error('refreshSession', err);
    return sendJson(res, 500, {
      success: false,
      message: MESSAGES.common.internalServerError,
      data: null,
    });
  }
}

export async function changePassword(req, res) {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      return sendJson(res, 401, { success: false, message: MESSAGES.common.unauthorized, data: null });
    }
    const { encryptedCurrentPassword, encryptedNewPassword } = req.body ?? {};
    let currentPlain;
    let newPlain;
    try {
      currentPlain = decryptPassword(encryptedCurrentPassword);
      newPlain = decryptPassword(encryptedNewPassword);
    } catch {
      return sendJson(res, 400, {
        success: false,
        message: MESSAGES.auth.invalidEncryptedPasswordPayload,
        data: null,
      });
    }
    const result = await authService.changePassword(userId, currentPlain, newPlain);
    return sendJson(res, result.statusCode, {
      success: result.success,
      message: result.message,
      data: result.data,
    });
  } catch (err) {
    console.error('changePassword', err);
    return sendJson(res, 500, {
      success: false,
      message: MESSAGES.common.internalServerError,
      data: null,
    });
  }
}

export async function setPassword(req, res) {
  try {
    let newPlain;
    let confirmPlain;
    try {
      newPlain = decryptPassword(req.body?.encryptedNewPassword);
      confirmPlain = decryptPassword(req.body?.encryptedConfirmPassword);
    } catch {
      return sendJson(res, 400, { success: false, message: MESSAGES.auth.invalidEncryptedPasswordPayload, data: null });
    }
    return sendSession(res, await authService.setNewPassword(req.auth, newPlain, confirmPlain));
  } catch (err) {
    console.error('setPassword', err);
    return sendJson(res, 500, { success: false, message: MESSAGES.common.internalServerError, data: null });
  }
}

export async function logout(req, res) {
  try {
    clearAuthCookie(res);
    return sendJson(res, 200, {
      success: true,
      message: MESSAGES.auth.loggedOut,
      data: null,
    });
  } catch (err) {
    console.error('logout', err);
    return sendJson(res, 500, {
      success: false,
      message: MESSAGES.common.internalServerError,
      data: null,
    });
  }
}

