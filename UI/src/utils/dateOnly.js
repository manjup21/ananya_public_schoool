/**
 * Calendar dates without time or timezone shift (avoid toISOString / Date-only string parsing bugs).
 */

/** YYYY-MM-DD from a local Date (e.g. react-datepicker). */
export function formatDateOnlyLocal(d) {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Like `formatDateOnlyLocal`, but `null` for missing/invalid dates (API payloads). */
export function toIsoDate(d) {
  return formatDateOnlyLocal(d) || null;
}

/** Today's local calendar date as YYYY-MM-DD. */
export function todayDateOnly() {
  return formatDateOnlyLocal(new Date());
}

/** Inclusive `{ from, to }` YYYY-MM-DD range covering the last `days` days ending today. */
export function lastDaysRange(days = 30) {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - (days - 1));
  return { from: formatDateOnlyLocal(from), to: formatDateOnlyLocal(to) };
}

/**
 * Parse API / DB date-only string into local calendar Date for pickers.
 * Avoids `new Date('YYYY-MM-DD')` which is treated as UTC and shifts the day in many zones.
 */
export function parseApiDateOnly(value) {
  if (value == null || String(value).trim() === '') return null;
  const part = String(value).split('T')[0];
  const [ys, ms, ds] = part.split('-');
  const y = Number(ys);
  const m = Number(ms);
  const day = Number(ds);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(day)) return null;
  const dt = new Date(y, m - 1, day);
  return Number.isNaN(dt.getTime()) ? null : dt;
}
