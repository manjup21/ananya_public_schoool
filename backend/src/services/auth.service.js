import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { callProcedure, pool } from '../db/db.js';
import { env } from '../utils/env.js';
import { fromDbRow } from '../utils/apiResponse.js';
import { MESSAGES } from '../constants/messages.js';
import * as userService from './user.service.js';
import { isStaffDefaultPin, staffPinRejectionReason } from '../utils/staffPin.js';

/** Password-setup sessions (still on the default PIN) can only set a new PIN. */
export const PASSWORD_SETUP_SESSION_MS = 15 * 60 * 1000;

const SQL = {
  getByEmailForAuth: 'SELECT * FROM public.atr_get_user_auth_by_email($1)',
  getByLecturerEmployeeId: 'SELECT * FROM public.atr_get_user_auth_by_lecturer_employee_id($1)',
  getById: 'SELECT * FROM public.atr_get_user_by_id($1)',
};

/** Legacy rows may still have role=admin before migration. */
function resolveCapabilityFlags(user) {
  const legacyAdmin = String(user?.role ?? '').toLowerCase() === 'admin';
  return {
    is_super_admin: Boolean(user?.is_super_admin) || legacyAdmin,
    is_admin: Boolean(user?.is_admin) || legacyAdmin,
    can_manage_fees: Boolean(user?.can_manage_fees),
  };
}

function signToken({ userId, email, role, flags, passwordSetup = false }) {
  if (!env.jwt.secret) {
    throw new Error(MESSAGES.auth.jwtSecretNotConfigured);
  }
  const payload = {
    userId,
    email,
    role,
    is_super_admin: flags.is_super_admin,
    is_admin: flags.is_admin,
    can_manage_fees: flags.can_manage_fees,
  };
  if (passwordSetup) payload.password_setup = true;
  return jwt.sign(payload, env.jwt.secret, { expiresIn: passwordSetup ? '15m' : env.jwt.expiresIn });
}

async function hasLecturerProfile(userId) {
  const r = await pool.query(
    'SELECT EXISTS(SELECT 1 FROM public.lecturers WHERE user_id = $1::uuid) AS ok',
    [userId]
  );
  return r.rows?.[0]?.ok === true;
}

async function withPortalFlags(user, { sessionRole } = {}) {
  if (!user) return user;
  const flags = resolveCapabilityFlags(user);
  const lecturerLinked = await hasLecturerProfile(user.id);
  const canSwitch = flags.is_admin && lecturerLinked;
  const role = sessionRole != null ? sessionRole : user.role;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role,
    db_role: String(user.role ?? '').toLowerCase() || null,
    is_super_admin: flags.is_super_admin,
    is_admin: flags.is_admin,
    can_manage_fees: flags.can_manage_fees,
    can_switch_portal: canSwitch,
    has_lecturer_profile: lecturerLinked,
  };
}

async function issueSession(user, role, { passwordSetup = false, message } = {}) {
  const token = signToken({
    userId: user.id,
    email: user.email,
    role,
    flags: resolveCapabilityFlags(user),
    passwordSetup,
  });
  const sessionUser = await withPortalFlags(user, { sessionRole: role });
  return {
    statusCode: 200,
    success: true,
    message: message ?? (passwordSetup ? MESSAGES.auth.passwordSetupRequired : MESSAGES.auth.loginSuccess),
    data: { token, user: passwordSetup ? { ...sessionUser, password_setup: true } : sessionUser },
  };
}

/** Default bootstrap PIN (000000) — forces Set PIN. */
function isDefaultPassword(_userId, plainPassword) {
  return isStaffDefaultPin(plainPassword);
}

/** Admin accounts whose staff profile has this 10-digit phone (ignoring spaces, dashes and +91). */
async function findAdminsByPhone(phone) {
  const r = await pool.query(
    `SELECT u.id, u.name, u.email, u.password_hash, u.role, u.can_manage_fees, u.is_super_admin, u.is_admin
     FROM public.users u
     JOIN public.lecturers l ON l.user_id = u.id
     WHERE (u.is_admin OR u.is_super_admin OR u.role = 'admin')
       AND RIGHT(regexp_replace(l.phone, '\\D', '', 'g'), 10) = $1`,
    [String(phone ?? '').trim()]
  );
  return r.rows ?? [];
}

export async function loginWithAdminPhone(phone, plainPassword) {
  const admins = await findAdminsByPhone(phone);
  if (admins.length > 1) {
    return { statusCode: 409, success: false, message: MESSAGES.auth.phoneLinkedToManyAdmins, data: null };
  }
  if (!admins.length) {
    return { statusCode: 401, success: false, message: MESSAGES.auth.invalidCredentials, data: null };
  }
  return adminLogin(admins[0], plainPassword);
}

export async function loginWithEmailPassword(email, plainPassword) {
  const normalizedEmail = String(email).trim().toLowerCase();
  const rows = await callProcedure(SQL.getByEmailForAuth, [normalizedEmail]);
  const result = fromDbRow(rows[0]);
  if (!result.success) return result;
  return adminLogin(result.data, plainPassword);
}

async function adminLogin(user, plainPassword) {
  const flags = resolveCapabilityFlags(user);
  if (!flags.is_super_admin && !flags.is_admin) {
    return {
      statusCode: 403,
      success: false,
      message: MESSAGES.auth.invalidCredentials,
      data: null,
    };
  }

  const passwordHash = user?.password_hash;
  if (!passwordHash) {
    return {
      statusCode: 500,
      success: false,
      message: MESSAGES.auth.passwordHashMissing,
      data: null,
    };
  }

  const ok = await bcrypt.compare(String(plainPassword), String(passwordHash));
  if (!ok) {
    return { statusCode: 401, success: false, message: MESSAGES.auth.invalidCredentials, data: null };
  }

  return issueSession(user, 'admin', { passwordSetup: isDefaultPassword(user.id, plainPassword) });
}

export async function loginWithLecturerEmployeeId(employeeId, plainPassword) {
  const normalizedEmployeeId = String(employeeId).trim().toUpperCase();
  const rows = await callProcedure(SQL.getByLecturerEmployeeId, [normalizedEmployeeId]);
  const result = fromDbRow(rows[0]);
  if (!result.success) return result;

  const user = result.data;
  const passwordHash = user?.password_hash;
  if (!passwordHash) {
    return {
      statusCode: 500,
      success: false,
      message: MESSAGES.auth.passwordHashMissing,
      data: null,
    };
  }

  const ok = await bcrypt.compare(String(plainPassword), String(passwordHash));
  if (!ok) {
    return {
      statusCode: 401,
      success: false,
      message: MESSAGES.auth.invalidLecturerCredentials,
      data: null,
    };
  }

  return issueSession(user, 'lecturer', { passwordSetup: isDefaultPassword(user.id, plainPassword) });
}

export async function getMe(userId, { sessionRole } = {}) {
  const rows = await callProcedure(SQL.getById, [userId]);
  const result = fromDbRow(rows[0]);
  if (!result.success || !result.data) return result;
  const enriched = await withPortalFlags(result.data, {
    sessionRole: sessionRole != null ? sessionRole : result.data.role,
  });
  return {
    ...result,
    data: enriched,
  };
}

/**
 * Re-issue JWT for an admin-portal user to open the Admin or Staff portal session.
 */
export async function switchPortal({ userId, portal }) {
  if (!userId) {
    return { statusCode: 401, success: false, message: MESSAGES.common.unauthorized, data: null };
  }

  const raw = String(portal ?? '')
    .trim()
    .toLowerCase();
  let targetRole = null;
  if (raw === 'admin') targetRole = 'admin';
  else if (raw === 'staff' || raw === 'lecturer') targetRole = 'lecturer';
  else {
    return {
      statusCode: 400,
      success: false,
      message: MESSAGES.auth.switchPortalInvalid,
      data: null,
    };
  }

  const rows = await callProcedure(SQL.getById, [userId]);
  const result = fromDbRow(rows[0]);
  if (!result.success || !result.data) return result;

  const user = result.data;
  const flags = resolveCapabilityFlags(user);
  if (!flags.is_admin) {
    return {
      statusCode: 403,
      success: false,
      message: MESSAGES.auth.switchPortalNotAllowed,
      data: null,
    };
  }

  const lecturerLinked = await hasLecturerProfile(user.id);
  if (targetRole === 'lecturer' && !lecturerLinked) {
    return {
      statusCode: 400,
      success: false,
      message: MESSAGES.auth.switchPortalNoLecturerProfile,
      data: null,
    };
  }

  const token = signToken({
    userId: user.id,
    email: user.email,
    role: targetRole,
    flags,
  });
  const sessionUser = await withPortalFlags(user, { sessionRole: targetRole });
  sessionUser.has_lecturer_profile = lecturerLinked;

  return {
    statusCode: 200,
    success: true,
    message: MESSAGES.auth.switchPortalSuccess,
    data: {
      token,
      user: sessionUser,
    },
  };
}

/**
 * Re-issue JWT from current DB flags, keeping the active portal session when still valid.
 * Used after the logged-in user updates their own capability checkboxes.
 */
export async function refreshSession({ userId, sessionRole }) {
  if (!userId) {
    return { statusCode: 401, success: false, message: MESSAGES.common.unauthorized, data: null };
  }

  const rows = await callProcedure(SQL.getById, [userId]);
  const result = fromDbRow(rows[0]);
  if (!result.success || !result.data) return result;

  const user = result.data;
  const flags = resolveCapabilityFlags(user);
  let role = String(sessionRole ?? 'lecturer').trim().toLowerCase();
  if (role !== 'admin' && role !== 'lecturer') {
    role = 'lecturer';
  }

  if (role === 'admin' && !flags.is_super_admin && !flags.is_admin) {
    role = 'lecturer';
  }

  if (role === 'lecturer') {
    const lecturerLinked = await hasLecturerProfile(user.id);
    if (!lecturerLinked) {
      if (flags.is_super_admin || flags.is_admin) {
        role = 'admin';
      } else {
        return {
          statusCode: 403,
          success: false,
          message: MESSAGES.auth.switchPortalNoLecturerProfile,
          data: null,
        };
      }
    }
  }

  const token = signToken({
    userId: user.id,
    email: user.email,
    role,
    flags,
  });
  const sessionUser = await withPortalFlags(user, { sessionRole: role });

  return {
    statusCode: 200,
    success: true,
    message: MESSAGES.auth.refreshSessionSuccess,
    data: {
      token,
      user: sessionUser,
    },
  };
}

function newPasswordError(nextPwd) {
  const reason = staffPinRejectionReason(nextPwd);
  if (!reason) return null;
  return { statusCode: 400, success: false, message: reason, data: null };
}

/** New PIN from a password-setup session (signed in with the default PIN). */
export async function setNewPassword(auth, newPlain, confirmPlain) {
  if (auth?.password_setup !== true) {
    return { statusCode: 400, success: false, message: MESSAGES.auth.passwordSetupOnly, data: null };
  }
  const nextPwd = String(newPlain ?? '');
  if (nextPwd !== String(confirmPlain ?? '')) {
    return { statusCode: 400, success: false, message: MESSAGES.auth.passwordsDoNotMatch, data: null };
  }
  const weak = newPasswordError(nextPwd);
  if (weak) return weak;

  const updated = await userService.updateUser(auth.userId, { password: nextPwd });
  if (!updated.success) return updated;

  const rows = await callProcedure(SQL.getById, [auth.userId]);
  const result = fromDbRow(rows[0]);
  if (!result.success || !result.data) return result;
  return issueSession(result.data, auth.role === 'admin' ? 'admin' : 'lecturer', {
    message: MESSAGES.auth.passwordSetSuccess,
  });
}

/**
 * @param {string} userId - users.id from JWT
 * @param {string} currentPlain
 * @param {string} newPlain
 */
export async function changePassword(userId, currentPlain, newPlain) {
  if (!userId) {
    return { statusCode: 400, success: false, message: MESSAGES.common.unauthorized, data: null };
  }
  const current = String(currentPlain ?? '');
  const nextPwd = String(newPlain ?? '');
  if (current.length === 0 || nextPwd.length === 0) {
    return {
      statusCode: 400,
      success: false,
      message: MESSAGES.auth.changePasswordFieldsRequired,
      data: null,
    };
  }
  if (nextPwd === current) {
    return {
      statusCode: 400,
      success: false,
      message: MESSAGES.auth.newPasswordSameAsCurrent,
      data: null,
    };
  }
  const weak = newPasswordError(nextPwd);
  if (weak) return weak;

  const r = await pool.query('SELECT password_hash FROM public.users WHERE id = $1::uuid', [userId]);
  if (!r.rows?.length) {
    return { statusCode: 404, success: false, message: MESSAGES.common.notFound, data: null };
  }
  const passwordHash = r.rows[0].password_hash;
  if (!passwordHash) {
    return {
      statusCode: 500,
      success: false,
      message: MESSAGES.auth.passwordHashMissing,
      data: null,
    };
  }

  const ok = await bcrypt.compare(current, String(passwordHash));
  if (!ok) {
    return {
      statusCode: 401,
      success: false,
      message: MESSAGES.auth.currentPasswordIncorrect,
      data: null,
    };
  }

  const updated = await userService.updateUser(userId, { password: nextPwd });
  if (!updated.success) {
    return updated;
  }
  return {
    statusCode: 200,
    success: true,
    message: MESSAGES.auth.changePasswordSuccess,
    data: null,
  };
}
