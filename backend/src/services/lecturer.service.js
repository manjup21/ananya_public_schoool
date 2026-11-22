import bcrypt from 'bcryptjs';
import { callProcedure, query as dbQuery, pool } from '../db/db.js';
import { env } from '../utils/env.js';
import { fromDbRow } from '../utils/apiResponse.js';
import { MESSAGES } from '../constants/messages.js';
import * as userService from './user.service.js';
import { STAFF_DEFAULT_PIN } from '../utils/staffPin.js';

/** Default staff/admin login PIN until they set their own on first login. */
export function buildInitialLecturerPassword(_firstName, _dateOfBirth) {
  return STAFF_DEFAULT_PIN;
}

const SQL = {
  create: 'SELECT * FROM public.atr_create_lecturer($1,$2,$3,$4,$5,$6,$7,$8,$9)',
  update: 'SELECT * FROM public.atr_update_lecturer($1,$2,$3,$4,$5,$6,$7,$8,$9)',
  delete: 'SELECT * FROM public.atr_delete_lecturer($1)',
  list: 'SELECT * FROM public.atr_get_lecturers($1,$2,$3)',
  getById: 'SELECT * FROM public.atr_get_lecturer_by_id($1)',
};

function normalizeSubjects(subjects) {
  if (Array.isArray(subjects)) return subjects.map((s) => String(s).trim()).filter(Boolean).join(',');
  return String(subjects ?? '').trim();
}

async function hashPassword(plain) {
  return bcrypt.hash(String(plain), env.bcryptRounds);
}

function extractCapabilityPayload(payload) {
  const patch = {};
  if (typeof payload?.is_super_admin === 'boolean') patch.is_super_admin = payload.is_super_admin;
  if (typeof payload?.is_admin === 'boolean') patch.is_admin = payload.is_admin;
  if (typeof payload?.can_manage_fees === 'boolean') patch.can_manage_fees = payload.can_manage_fees;
  // Legacy field names from older UI/API
  if (typeof payload?.make_admin === 'boolean') patch.is_admin = payload.make_admin;
  if (typeof payload?.make_fee_manager === 'boolean') patch.can_manage_fees = payload.make_fee_manager;
  return patch;
}

function hasCapabilityFields(payload) {
  return (
    typeof payload?.is_super_admin === 'boolean' ||
    typeof payload?.is_admin === 'boolean' ||
    typeof payload?.can_manage_fees === 'boolean' ||
    typeof payload?.make_admin === 'boolean' ||
    typeof payload?.make_fee_manager === 'boolean'
  );
}

async function countSuperAdmins(excludeUserId = null) {
  const r = await pool.query(
    `SELECT COUNT(*)::int AS n FROM public.users
     WHERE is_super_admin = TRUE
       AND ($1::uuid IS NULL OR id <> $1::uuid)`,
    [excludeUserId]
  );
  return r.rows?.[0]?.n ?? 0;
}

async function applyUserCapabilities(userId, patch) {
  if (!Object.keys(patch).length) return { success: true };
  return userService.updateUser(userId, { role: 'lecturer', ...patch });
}

function enrichLecturerWithFlags(lecturer, userRow) {
  const legacyAdmin = userRow?.role === 'admin';
  return {
    ...lecturer,
    is_super_admin: Boolean(userRow?.is_super_admin) || legacyAdmin,
    is_admin: Boolean(userRow?.is_admin) || legacyAdmin,
    can_manage_fees: Boolean(userRow?.can_manage_fees),
  };
}

export async function createLecturer(payload, { callerAuth } = {}) {
  const capabilityPatch = extractCapabilityPayload(payload);
  if (Object.keys(capabilityPatch).length && !callerAuth?.is_super_admin) {
    return { statusCode: 403, success: false, message: MESSAGES.common.forbidden, data: null };
  }

  const provided = payload.password != null && String(payload.password).trim() !== '';
  const plain = provided
    ? String(payload.password).trim()
    : buildInitialLecturerPassword(payload.first_name, payload.date_of_birth);
  const passwordHash = await hashPassword(plain);
  const rows = await callProcedure(SQL.create, [
    payload.title ?? null,
    String(payload.first_name).trim(),
    String(payload.last_name).trim(),
    String(payload.employee_id).trim(),
    String(payload.email).trim().toLowerCase(),
    String(payload.phone).trim(),
    payload.date_of_birth,
    normalizeSubjects(payload.subjects),
    passwordHash,
  ]);
  const result = fromDbRow(rows[0]);
  if (!result.success) return result;

  const userId = result.data?.user_id;
  if (userId && Object.keys(capabilityPatch).length) {
    const updated = await applyUserCapabilities(userId, capabilityPatch);
    if (!updated.success) return updated;
    if (result.data && typeof result.data === 'object') {
      Object.assign(result.data, capabilityPatch);
    }
  } else if (result.data && typeof result.data === 'object') {
    result.data = {
      ...result.data,
      is_super_admin: false,
      is_admin: false,
      can_manage_fees: false,
    };
  }

  if (result.success && result.data != null && typeof result.data === 'object' && !provided) {
    return {
      ...result,
      data: { ...result.data, initial_password: plain },
    };
  }
  return result;
}

export async function updateLecturer(lecturerId, payload, { callerAuth } = {}) {
  const capabilityPatch = extractCapabilityPayload(payload);
  let userIdForFlags = null;

  if (hasCapabilityFields(payload)) {
    if (!callerAuth?.is_super_admin) {
      return { statusCode: 403, success: false, message: MESSAGES.common.forbidden, data: null };
    }
    const existingRows = await callProcedure(SQL.getById, [lecturerId]);
    const existing = fromDbRow(existingRows?.[0]);
    if (!existing.success) return existing;
    userIdForFlags = existing.data?.user_id;
    if (!userIdForFlags) {
      return { statusCode: 500, success: false, message: MESSAGES.common.internalServerError, data: null };
    }

    if (capabilityPatch.is_super_admin === false) {
      const current = await pool.query(
        'SELECT is_super_admin FROM public.users WHERE id = $1::uuid',
        [userIdForFlags]
      );
      if (current.rows?.[0]?.is_super_admin === true) {
        const others = await countSuperAdmins(userIdForFlags);
        if (others === 0) {
          return {
            statusCode: 400,
            success: false,
            message: 'Cannot remove the last Super Admin',
            data: null,
          };
        }
      }
    }
  }

  const rows = await callProcedure(SQL.update, [
    lecturerId,
    payload.title ?? null,
    payload.first_name !== undefined ? String(payload.first_name).trim() : null,
    payload.last_name !== undefined ? String(payload.last_name).trim() : null,
    payload.employee_id !== undefined ? String(payload.employee_id).trim() : null,
    payload.email !== undefined ? String(payload.email).trim().toLowerCase() : null,
    payload.phone !== undefined ? String(payload.phone).trim() : null,
    payload.date_of_birth ?? null,
    payload.subjects !== undefined ? normalizeSubjects(payload.subjects) : null,
  ]);
  const result = fromDbRow(rows[0]);
  if (!result.success) return result;

  if (userIdForFlags && Object.keys(capabilityPatch).length) {
    const updated = await applyUserCapabilities(userIdForFlags, capabilityPatch);
    if (!updated.success) return updated;
    if (result.data && typeof result.data === 'object') {
      Object.assign(result.data, capabilityPatch);
    }
  }
  return result;
}

export async function deleteLecturer(lecturerId) {
  const rows = await callProcedure(SQL.delete, [lecturerId]);
  return fromDbRow(rows[0]);
}

export async function getLecturers(query) {
  const rows = await callProcedure(SQL.list, [query.page, query.limit, query.search]);
  const result = fromDbRow(rows[0]);
  if (!result.success) return result;

  const list = result.data?.lecturers;
  if (!Array.isArray(list) || list.length === 0) return result;

  const userIds = [...new Set(list.map((l) => l?.user_id).filter(Boolean))];
  if (userIds.length === 0) return result;

  const roleRows = await dbQuery(
    'SELECT id, role, can_manage_fees, is_super_admin, is_admin FROM public.users WHERE id = ANY($1::uuid[])',
    [userIds]
  );
  const roleById = new Map(roleRows.map((r) => [r.id, r]));
  result.data.lecturers = list.map((l) => enrichLecturerWithFlags(l, roleById.get(l.user_id)));

  return result;
}

export async function getLecturerById(lecturerId) {
  const rows = await callProcedure(SQL.getById, [lecturerId]);
  const result = fromDbRow(rows[0]);
  if (!result.success) return result;

  const userId = result.data?.user_id;
  if (userId) {
    const roleRows = await dbQuery(
      'SELECT role, can_manage_fees, is_super_admin, is_admin FROM public.users WHERE id = $1::uuid',
      [userId]
    );
    const u = roleRows?.[0];
    if (result.data && typeof result.data === 'object') {
      result.data = enrichLecturerWithFlags(result.data, u);
    }
  }

  return result;
}

export async function resetLecturerPassword(lecturerId) {
  const rows = await callProcedure(SQL.getById, [lecturerId]);
  const result = fromDbRow(rows[0]);
  if (!result.success) return result;
  const userId = result.data?.user_id;
  if (!userId) {
    return { statusCode: 500, success: false, message: MESSAGES.common.internalServerError, data: null };
  }

  const tempPassword = buildInitialLecturerPassword(result.data?.first_name, result.data?.date_of_birth);
  const updated = await userService.updateUser(userId, { password: tempPassword });
  if (!updated.success) return updated;

  return {
    statusCode: 200,
    success: true,
    message: MESSAGES.lecturer.passwordResetSuccess,
    data: { temporary_password: tempPassword },
  };
}
