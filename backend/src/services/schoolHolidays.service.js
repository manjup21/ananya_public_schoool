import { callProcedure } from '../db/db.js';
import { fromDbRow } from '../utils/apiResponse.js';
import { optStr, optUuid } from '../utils/params.js';

const SQL = {
  list:
    'SELECT * FROM public.atr_list_school_holidays(' +
    '$1::text,' +
    '$2::date,' +
    '$3::date,' +
    '$4::boolean' +
    ')',
  create: 'SELECT * FROM public.atr_create_school_holiday($1::varchar,$2::date,$3::date,$4::uuid)',
  update:
    'SELECT * FROM public.atr_update_school_holiday(' +
    '$1::uuid,' +
    '$2::varchar,' +
    '$3::date,' +
    '$4::date,' +
    '$5::boolean,' +
    '$6::uuid' +
    ')',
  delete: 'SELECT * FROM public.atr_delete_school_holiday($1::uuid)',
};

function optDate(v) {
  return optStr(v);
}

function optBool(v) {
  if (v === undefined || v === null || v === '') return null;
  if (typeof v === 'boolean') return v;
  if (v === 0 || v === 1) return v === 1;
  const s = String(v).trim().toLowerCase();
  if (s === 'true' || s === '1') return true;
  if (s === 'false' || s === '0') return false;
  return null;
}

export async function listSchoolHolidays({ search, from, to, isActive }) {
  const rows = await callProcedure(SQL.list, [optStr(search), optDate(from), optDate(to), optBool(isActive)]);
  const result = fromDbRow(rows?.[0]);
  if (!result.success) return result;
  const list = Array.isArray(result.data) ? result.data : [];
  return { ...result, data: { holidays: list } };
}

export async function createSchoolHoliday(payload, actorUserId) {
  const rows = await callProcedure(SQL.create, [
    optStr(payload?.name),
    optDate(payload?.start_date),
    optDate(payload?.end_date),
    optUuid(actorUserId),
  ]);
  return fromDbRow(rows?.[0]);
}

export async function updateSchoolHoliday(id, payload, actorUserId) {
  const rows = await callProcedure(SQL.update, [
    optUuid(id),
    payload?.name === undefined ? null : optStr(payload.name),
    payload?.start_date === undefined ? null : optDate(payload.start_date),
    payload?.end_date === undefined ? null : optDate(payload.end_date),
    payload?.is_active === undefined ? null : optBool(payload.is_active),
    optUuid(actorUserId),
  ]);
  return fromDbRow(rows?.[0]);
}

export async function deleteSchoolHoliday(id) {
  const rows = await callProcedure(SQL.delete, [optUuid(id)]);
  return fromDbRow(rows?.[0]);
}
