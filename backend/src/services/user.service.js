import bcrypt from 'bcryptjs';
import { callProcedure } from '../db/db.js';
import { env } from '../utils/env.js';
import { fromDbRow } from '../utils/apiResponse.js';

/* Stored procs are created unquoted in PostgreSQL → lowercase names in catalog */
/** Unquoted identifiers in PostgreSQL are lowercased; use public schema explicitly. */
const SQL = {
  create: 'SELECT * FROM public.atr_create_user($1, $2, $3, $4)',
  update: 'SELECT * FROM public.atr_update_user($1, $2, $3, $4, $5, $6, $7, $8)',
  delete: 'SELECT * FROM public.atr_delete_user($1)',
  list: 'SELECT * FROM public.atr_get_users($1, $2, $3)',
};

async function hashPassword(plain) {
  return bcrypt.hash(plain, env.bcryptRounds);
}

/**
 * @param {{ name: string, email: string, password: string, role: string }} payload
 */
export async function createUser(payload) {
  const password_hash = await hashPassword(payload.password);
  const rows = await callProcedure(SQL.create, [
    String(payload.name).trim(),
    String(payload.email).trim(),
    password_hash,
    String(payload.role).trim(),
  ]);
  return fromDbRow(rows[0]);
}

/**
 * @param {string} userId - UUID
 * @param {{ name?: string, email?: string, password?: string, role?: string, can_manage_fees?: boolean, is_super_admin?: boolean, is_admin?: boolean }} payload
 */
export async function updateUser(userId, payload) {
  const name = payload.name !== undefined ? String(payload.name).trim() : null;
  const email = payload.email !== undefined ? String(payload.email).trim() : null;
  const role = payload.role !== undefined ? String(payload.role).trim() : null;
  const canManageFees =
    payload.can_manage_fees !== undefined ? Boolean(payload.can_manage_fees) : null;
  const isSuperAdmin =
    payload.is_super_admin !== undefined ? Boolean(payload.is_super_admin) : null;
  const isAdmin = payload.is_admin !== undefined ? Boolean(payload.is_admin) : null;
  let password_hash = null;
  if (payload.password !== undefined && payload.password !== null) {
    password_hash = await hashPassword(String(payload.password));
  }
  const rows = await callProcedure(SQL.update, [
    userId,
    name,
    email,
    password_hash,
    role,
    canManageFees,
    isSuperAdmin,
    isAdmin,
  ]);
  return fromDbRow(rows[0]);
}

/**
 * @param {string} userId - UUID
 */
export async function deleteUser(userId) {
  const rows = await callProcedure(SQL.delete, [userId]);
  return fromDbRow(rows[0]);
}

/**
 * @param {{ page: number, limit: number, search: string | null }} query
 */
export async function getUsers(query) {
  const rows = await callProcedure(SQL.list, [query.page, query.limit, query.search]);
  return fromDbRow(rows[0]);
}
