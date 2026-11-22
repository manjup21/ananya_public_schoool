/** Staff/admin login uses a 6-digit PIN. */
export const STAFF_PIN_LENGTH = 6;
/** Issued on create / reset; login with this forces a PIN change. */
export const STAFF_DEFAULT_PIN = '000000';

const BANNED_NEW_PINS = new Set(['123456', STAFF_DEFAULT_PIN]);

export function isStaffDefaultPin(raw) {
  return String(raw ?? '').trim() === STAFF_DEFAULT_PIN;
}

/** @returns {string | null} rejection message for a new PIN (not for login) */
export function staffPinRejectionReason(pin) {
  const s = String(pin ?? '').trim();
  if (!/^\d{6}$/.test(s)) return 'PIN must be 6 digits';
  if (BANNED_NEW_PINS.has(s) || /^(\d)\1{5}$/.test(s)) return 'Choose a different PIN';
  return null;
}
