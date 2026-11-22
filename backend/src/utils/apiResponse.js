/**
 * Consistent JSON envelope for API responses.
 */
export function sendJson(res, statusCode, { success, message, data = null }) {
  return res.status(statusCode).json({
    success,
    message,
    data,
  });
}

export function fromDbRow(row) {
  if (!row) {
    return { statusCode: 500, success: false, message: 'Empty database response', data: null };
  }
  const statusCode = Number(row.status_code);
  const success = statusCode >= 200 && statusCode < 300;
  return {
    statusCode,
    success,
    message: row.message ?? '',
    data: row.data ?? null,
  };
}
