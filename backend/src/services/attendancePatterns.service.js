import { callProcedure } from '../db/db.js';
import { fromDbRow } from '../utils/apiResponse.js';
import { optStr, optUuid } from '../utils/params.js';

const SQL = {
  list: 'SELECT * FROM public.atr_list_attendance_patterns($1,$2,$3,$4,$5)',
  getById: 'SELECT * FROM public.atr_get_attendance_pattern($1)',
  // Cast params explicitly so Postgres doesn't see "unknown" types.
  create:
    'SELECT * FROM public.atr_create_attendance_pattern(' +
    '$1::varchar,' + // name
    '$2::varchar,' + // scope
    '$3::date,' + // start_date
    '$4::date,' + // end_date
    '$5::uuid,' + // class_id
    '$6::uuid,' + // section_id
    '$7::uuid[],' + // section_ids
    '$8::int[],' + // days_of_week
    '$9::time[],' + // slot_times (legacy / optional)
    '$10::text[],' + // slot_names
    '$11::boolean,' + // same_slots_all_days
    '$12::jsonb,' + // slot_names_by_dow
    '$13::uuid' + // created_by
    ')',
  update:
    'SELECT * FROM public.atr_update_attendance_pattern(' +
    '$1::uuid,' + // pattern_id
    '$2::varchar,' + // name
    '$3::varchar,' + // scope
    '$4::uuid,' + // class_id
    '$5::uuid,' + // section_id
    '$6::date,' + // start_date
    '$7::date,' + // end_date
    '$8::int[],' + // days_of_week
    '$9::time[],' + // slot_times
    '$10::text[],' + // slot_names
    '$11::boolean,' + // same_slots_all_days
    '$12::jsonb,' + // slot_names_by_dow
    '$13::boolean,' + // is_active
    '$14::uuid' + // updated_by
    ')',
  version:
    'SELECT * FROM public.atr_version_attendance_pattern(' +
    '$1::uuid,' + // old_pattern_id
    '$2::varchar,' + // name
    '$3::varchar,' + // scope
    '$4::uuid,' + // class_id
    '$5::uuid,' + // section_id
    '$6::date,' + // end_date
    '$7::int[],' + // days_of_week
    '$8::text[],' + // slot_names
    '$9::boolean,' + // same_slots_all_days
    '$10::jsonb,' + // slot_names_by_dow
    '$11::uuid' + // updated_by
    ')',
  delete: 'SELECT * FROM public.atr_delete_attendance_pattern($1)',
  resolve: 'SELECT * FROM public.atr_resolve_attendance_pattern($1,$2,$3)',
};

function optUuidArray(arr) {
  if (arr === undefined || arr === null) return null;
  if (!Array.isArray(arr)) return null;
  const out = [];
  for (const x of arr) {
    const s = optUuid(x);
    if (!s) return null;
    out.push(s);
  }
  return out;
}

function optBool(v) {
  if (v === undefined || v === null) return null;
  if (typeof v === 'boolean') return v;
  const s = String(v).trim().toLowerCase();
  if (s === 'true') return true;
  if (s === 'false') return false;
  return null;
}

function optIntArray(arr) {
  if (arr === undefined || arr === null) return null;
  if (!Array.isArray(arr)) return null;
  const out = [];
  for (const x of arr) {
    const n = Number(x);
    if (!Number.isFinite(n)) return null;
    out.push(Math.trunc(n));
  }
  return out;
}

function optTimeArray(arr) {
  if (arr === undefined || arr === null) return null;
  if (!Array.isArray(arr)) return null;
  const out = [];
  for (const x of arr) {
    const s = optStr(x);
    if (!s) return null;
    out.push(s); // pg will cast string -> time
  }
  return out;
}

function normalizeSlotName(v) {
  const s = optStr(v);
  if (!s) return null;
  return s.replace(/\s+/g, ' ').trim();
}

function optSlotNamesFromGlobalSlots(slotsGlobal) {
  if (slotsGlobal === undefined || slotsGlobal === null) return null;
  if (!Array.isArray(slotsGlobal)) return null;
  const out = [];
  for (const item of slotsGlobal) {
    if (typeof item === 'string') {
      const name = normalizeSlotName(item);
      if (!name) return null;
      out.push(name);
      continue;
    }
    const name = normalizeSlotName(item?.slot_name ?? item?.name ?? item?.label);
    if (!name) return null;
    out.push(name);
  }
  return out;
}

function optSlotNamesByDowJson(slotsByDow) {
  if (slotsByDow === undefined || slotsByDow === null) return null;
  if (typeof slotsByDow !== 'object' || Array.isArray(slotsByDow)) return null;
  const normalized = {};
  for (const [dow, arr] of Object.entries(slotsByDow)) {
    if (!Array.isArray(arr)) return null;
    const out = [];
    for (const item of arr) {
      if (typeof item === 'string') {
        const name = normalizeSlotName(item);
        if (!name) return null;
        out.push(name);
        continue;
      }
      const name = normalizeSlotName(item?.slot_name ?? item?.name ?? item?.label);
      if (!name) return null;
      out.push(name);
    }
    normalized[String(dow)] = out;
  }
  return normalized;
}

export async function listAttendancePatterns({ search, scope, classId, sectionId, isActive }) {
  const rows = await callProcedure(SQL.list, [
    optStr(search),
    optStr(scope),
    optUuid(classId),
    optUuid(sectionId),
    optBool(isActive),
  ]);
  const result = fromDbRow(rows?.[0]);
  if (!result.success) return result;
  return { ...result, data: { patterns: Array.isArray(result.data) ? result.data : [] } };
}

export async function getAttendancePatternById(patternId) {
  const rows = await callProcedure(SQL.getById, [optUuid(patternId)]);
  return fromDbRow(rows?.[0]);
}

export async function createAttendancePattern(payload, actorUserId) {
  const slotNames = optSlotNamesFromGlobalSlots(payload?.slots_global);
  const sameSlotsAllDays =
    payload?.same_slots_all_days === undefined || payload?.same_slots_all_days === null ? null : optBool(payload.same_slots_all_days);
  const slotNamesByDow = optSlotNamesByDowJson(payload?.slots_by_dow);

  const rows = await callProcedure(SQL.create, [
    optStr(payload.name),
    optStr(payload.scope),
    payload.start_date ?? null,
    payload.end_date ?? null,
    optUuid(payload.class_id),
    optUuid(payload.section_id),
    optUuidArray(payload.section_ids),
    optIntArray(payload.days_of_week),
    optTimeArray(payload.slot_times),
    slotNames,
    sameSlotsAllDays ?? true,
    slotNamesByDow ? JSON.stringify(slotNamesByDow) : null,
    optUuid(actorUserId),
  ]);
  return fromDbRow(rows?.[0]);
}

export async function updateAttendancePattern(patternId, payload, actorUserId) {
  const hasNewSlotsShape =
    payload?.slots_global !== undefined ||
    payload?.slots_by_dow !== undefined ||
    payload?.same_slots_all_days !== undefined;
  const slotNames = hasNewSlotsShape ? optSlotNamesFromGlobalSlots(payload?.slots_global) : null;
  const sameSlotsAllDays =
    payload?.same_slots_all_days === undefined || payload?.same_slots_all_days === null ? null : optBool(payload.same_slots_all_days);
  const slotNamesByDow = hasNewSlotsShape ? optSlotNamesByDowJson(payload?.slots_by_dow) : null;

  const rows = await callProcedure(SQL.update, [
    optUuid(patternId),
    payload.name === undefined ? null : optStr(payload.name),
    payload.scope === undefined ? null : optStr(payload.scope),
    payload.class_id === undefined ? null : optUuid(payload.class_id),
    payload.section_id === undefined ? null : optUuid(payload.section_id),
    payload.start_date === undefined ? null : payload.start_date,
    payload.end_date === undefined ? null : payload.end_date,
    payload.days_of_week === undefined ? null : optIntArray(payload.days_of_week),
    payload.slot_times === undefined ? null : optTimeArray(payload.slot_times),
    slotNames,
    sameSlotsAllDays,
    slotNamesByDow ? JSON.stringify(slotNamesByDow) : null,
    payload.is_active === undefined ? null : optBool(payload.is_active),
    optUuid(actorUserId),
  ]);
  return fromDbRow(rows?.[0]);
}

export async function versionAttendancePattern(patternId, payload, actorUserId) {
  const hasNewSlotsShape =
    payload?.slots_global !== undefined ||
    payload?.slots_by_dow !== undefined ||
    payload?.same_slots_all_days !== undefined;
  const slotNames = hasNewSlotsShape ? optSlotNamesFromGlobalSlots(payload?.slots_global) : null;
  const sameSlotsAllDays =
    payload?.same_slots_all_days === undefined || payload?.same_slots_all_days === null ? null : optBool(payload.same_slots_all_days);
  const slotNamesByDow = hasNewSlotsShape ? optSlotNamesByDowJson(payload?.slots_by_dow) : null;

  const rows = await callProcedure(SQL.version, [
    optUuid(patternId),
    optStr(payload?.name),
    optStr(payload?.scope),
    optUuid(payload?.class_id),
    optUuid(payload?.section_id),
    payload?.end_date ?? null,
    optIntArray(payload?.days_of_week),
    slotNames,
    sameSlotsAllDays ?? true,
    slotNamesByDow ? JSON.stringify(slotNamesByDow) : null,
    optUuid(actorUserId),
  ]);
  return fromDbRow(rows?.[0]);
}

export async function deleteAttendancePattern(patternId) {
  const rows = await callProcedure(SQL.delete, [optUuid(patternId)]);
  return fromDbRow(rows?.[0]);
}

export async function resolveAttendancePattern({ classId, date, sectionId }) {
  const rows = await callProcedure(SQL.resolve, [optUuid(classId), date ?? null, optUuid(sectionId)]);
  return fromDbRow(rows?.[0]);
}

