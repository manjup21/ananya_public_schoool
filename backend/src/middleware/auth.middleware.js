import jwt from 'jsonwebtoken';
import { env } from '../utils/env.js';
import { sendJson } from '../utils/apiResponse.js';
import { MESSAGES } from '../constants/messages.js';

/** The only endpoints a password-setup session (still on the default password) may call. */
const PASSWORD_SETUP_PATHS = ['/auth/set-password', '/auth/me', '/auth/logout'];

function getTokenFromRequest(req) {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7).trim();
  }
  const cookieToken = req.cookies?.[env.jwt.cookieName];
  if (cookieToken) return cookieToken;
  return null;
}

export function verifyToken(req, res, next) {
  try {
    const token = getTokenFromRequest(req);
    if (!token) {
      return sendJson(res, 401, {
        success: false,
        message: MESSAGES.common.unauthorized,
        data: null,
      });
    }
    if (!env.jwt.secret) {
      return sendJson(res, 500, {
        success: false,
        message: MESSAGES.auth.jwtSecretNotConfigured,
        data: null,
      });
    }
    const payload = jwt.verify(token, env.jwt.secret);
    req.auth = payload;
    const path = req.originalUrl.split('?')[0];
    if (payload.password_setup === true && !PASSWORD_SETUP_PATHS.some((p) => path.endsWith(p))) {
      return sendJson(res, 403, {
        success: false,
        message: MESSAGES.auth.passwordSetupRequired,
        data: { passwordSetup: true },
      });
    }
    next();
  } catch (err) {
    return sendJson(res, 401, {
      success: false,
      message: MESSAGES.common.invalidOrExpiredToken,
      data: null,
    });
  }
}

export function authorizeRole(...allowedRoles) {
  const allow = new Set(allowedRoles.map((r) => String(r).trim().toLowerCase()));
  return (req, res, next) => {
    const raw = req.auth?.role;
    const role = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
    if (!role || !allow.has(role)) {
      console.warn('authorizeRole denied', {
        path: req.originalUrl,
        role: raw,
        allowed: [...allow],
      });
      return sendJson(res, 403, {
        success: false,
        message: MESSAGES.common.forbidden,
        data: null,
      });
    }
    next();
  };
}

function authFlags(req) {
  const legacyAdmin = String(req.auth?.role ?? '').toLowerCase() === 'admin' && req.auth?.is_admin == null;
  return {
    is_super_admin: req.auth?.is_super_admin === true || legacyAdmin,
    is_admin: req.auth?.is_admin === true || legacyAdmin,
    can_manage_fees: req.auth?.can_manage_fees === true,
  };
}

/** Fee Management only staff: can_manage_fees and not operational admin. */
function isFeeOnlyStaffSession(req) {
  const role = String(req.auth?.role ?? '').toLowerCase();
  if (role !== 'lecturer') return false;
  const flags = authFlags(req);
  return flags.can_manage_fees && !flags.is_admin;
}

/** Staff CRUD and role assignment. */
function authorizeSuperAdmin(req, res, next) {
  if (authFlags(req).is_super_admin) return next();
  console.warn('authorizeSuperAdmin denied', { path: req.originalUrl, userId: req.auth?.userId });
  return sendJson(res, 403, { success: false, message: MESSAGES.common.forbidden, data: null });
}

/** Operational admin modules (students, exams, notifications, etc.). */
function authorizeOperationalAdmin(req, res, next) {
  if (authFlags(req).is_admin) return next();
  console.warn('authorizeOperationalAdmin denied', { path: req.originalUrl, userId: req.auth?.userId });
  return sendJson(res, 403, { success: false, message: MESSAGES.common.forbidden, data: null });
}

/** Fee Management APIs. */
export function authorizeFeeManager(req, res, next) {
  if (authFlags(req).can_manage_fees) return next();
  console.warn('authorizeFeeManager denied', {
    path: req.originalUrl,
    userId: req.auth?.userId,
    can_manage_fees: req.auth?.can_manage_fees,
  });
  return sendJson(res, 403, { success: false, message: MESSAGES.common.forbidden, data: null });
}

/**
 * Reject fee-only staff sessions from full staff APIs.
 * Fee-only = lecturer session with can_manage_fees and without is_admin.
 */
function rejectFeeOnlyStaff(req, res, next) {
  if (!isFeeOnlyStaffSession(req)) return next();
  console.warn('rejectFeeOnlyStaff denied', {
    path: req.originalUrl,
    userId: req.auth?.userId,
  });
  return sendJson(res, 403, { success: false, message: MESSAGES.common.forbidden, data: null });
}

/** Full staff portal APIs (not fee-only). Lecturer session required. */
export function requireFullStaff(req, res, next) {
  authorizeRole('lecturer')(req, res, () => {
    if (res.headersSent) return;
    rejectFeeOnlyStaff(req, res, next);
  });
}

/** Staff session (non fee-only) or operational admin session. */
export function authorizeStaffOrOperationalAdmin(req, res, next) {
  const role = String(req.auth?.role ?? '').toLowerCase();
  const flags = authFlags(req);
  if (role === 'admin' && flags.is_admin) return next();
  if (role === 'lecturer' && !isFeeOnlyStaffSession(req)) return next();
  console.warn('authorizeStaffOrOperationalAdmin denied', {
    path: req.originalUrl,
    role,
    feeOnly: isFeeOnlyStaffSession(req),
  });
  return sendJson(res, 403, { success: false, message: MESSAGES.common.forbidden, data: null });
}

/**
 * Shared reads used by staff, operational admin, and Fee Management UI (e.g. class list filters).
 * Fee-only staff are allowed here.
 */
export function authorizeStaffOperationalOrFeeManager(req, res, next) {
  if (authFlags(req).can_manage_fees) return next();
  return authorizeStaffOrOperationalAdmin(req, res, next);
}

/** Admin session + operational admin capability. */
export function requireOperationalAdmin(req, res, next) {
  authorizeRole('admin')(req, res, () => {
    if (res.headersSent) return;
    authorizeOperationalAdmin(req, res, next);
  });
}

/** Admin session + super admin capability (staff CRUD). */
export function requireSuperAdmin(req, res, next) {
  authorizeRole('admin')(req, res, () => {
    if (res.headersSent) return;
    authorizeSuperAdmin(req, res, next);
  });
}
