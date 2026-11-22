import { isIsoDate } from '../utils/validators.js';

export function validateDashboardRange(req, res, next) {
  const { from, to } = req.query ?? {};
  if (!isIsoDate(String(from ?? '')) || !isIsoDate(String(to ?? ''))) {
    return res.status(400).json({ success: false, message: 'from and to must be YYYY-MM-DD', data: null });
  }
  next();
}

