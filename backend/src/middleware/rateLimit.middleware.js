import rateLimit from 'express-rate-limit';
import { env } from '../utils/env.js';
import { MESSAGES } from '../constants/messages.js';

function rateLimitHandler(req, res) {
  res.status(429).json({
    success: false,
    message: MESSAGES.common.tooManyRequests,
    data: null,
  });
}

function createLimiter({ windowMs, max, skip }) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    skip,
    handler: rateLimitHandler,
  });
}

const disabled = () => false;

/** Brute-force protection for POST /auth/login */
export const loginRateLimiter = createLimiter({
  windowMs: env.rateLimit.login.windowMs,
  max: env.rateLimit.login.max,
  skip: env.rateLimit.enabled ? disabled : () => true,
});

/** Optional cap on all /api routes (per IP) */
export const apiRateLimiter = createLimiter({
  windowMs: env.rateLimit.api.windowMs,
  max: env.rateLimit.api.max,
  skip: env.rateLimit.enabled ? disabled : () => true,
});
