import { sendJson } from '../utils/apiResponse.js';
import { MESSAGES } from '../constants/messages.js';

export function validateChangePasswordBody(req, res, next) {
  const b = req.body ?? {};
  if (
    b.encryptedCurrentPassword == null ||
    String(b.encryptedCurrentPassword).trim() === '' ||
    b.encryptedNewPassword == null ||
    String(b.encryptedNewPassword).trim() === ''
  ) {
    return sendJson(res, 400, {
      success: false,
      message: MESSAGES.auth.changePasswordFieldsRequired,
      data: null,
    });
  }
  next();
}
