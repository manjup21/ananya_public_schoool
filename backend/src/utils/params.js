/** Normalizers for optional request values passed to stored procedures. */

export function optStr(v) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

export const optUuid = optStr;

/** Whitespace-only strings become 0 (Number(' ')), not null; use optIntTrimmed to treat them as empty. */
export function optInt(v) {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

export function optIntTrimmed(v) {
  if (v === undefined || v === null || String(v).trim() === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

/** Authenticated user id from the verified JWT (`verifyToken`). */
export function actorId(req) {
  return req.auth?.userId;
}
