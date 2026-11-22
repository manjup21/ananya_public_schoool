import { env } from './env.js';

function cookieOptions() {
  const isProd = env.nodeEnv === 'production';
  return { httpOnly: true, secure: isProd, sameSite: isProd ? 'none' : 'lax' };
}

export function setAuthCookie(res, token, maxAgeMs) {
  res.cookie(env.jwt.cookieName, token, { ...cookieOptions(), maxAge: maxAgeMs });
}

export function clearAuthCookie(res) {
  res.clearCookie(env.jwt.cookieName, cookieOptions());
}
