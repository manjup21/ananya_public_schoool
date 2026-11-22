export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Any-version UUID; no trimming, so padded ids are rejected. */
export function isUuid(v) {
  return UUID_REGEX.test(String(v));
}

/** RFC 4122 v1–v5 UUID; trims and requires a string. */
const RFC_UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isRfcUuid(v) {
  return typeof v === 'string' && RFC_UUID_REGEX.test(v.trim());
}

/** Strict YYYY-MM-DD calendar date string. */
export function isIsoDate(v) {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v.trim())) return false;
  const d = new Date(`${v.trim()}T00:00:00Z`);
  return !Number.isNaN(d.getTime());
}
