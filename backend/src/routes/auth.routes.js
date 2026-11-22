import { Router } from 'express';
import * as authController from '../controllers/auth.controller.js';
import { verifyToken } from '../middleware/auth.middleware.js';
import { validateChangePasswordBody } from '../middleware/authChangePassword.validation.js';
import { loginRateLimiter } from '../middleware/rateLimit.middleware.js';

const router = Router();

/**
 * POST /auth/login
 * Body: { encryptedPassword, email? | phone? } for admin — or { encryptedPassword, employeeId? } for lecturer.
 * Response (200):
 * { success: true, message: "Login successful", data: { token, user: { id,name,email,role } } }
 * user.password_setup = true when the default password was used: the session can only call /auth/set-password.
 */
router.post('/login', loginRateLimiter, authController.login);

/**
 * POST /auth/set-password
 * Body: { encryptedNewPassword, encryptedConfirmPassword }. Requires a password-setup session.
 * Returns a normal session { token, user }.
 */
router.post('/set-password', verifyToken, authController.setPassword);

/**
 * GET /auth/me
 * Requires: cookie token or Authorization: Bearer <token>
 */
router.get('/me', verifyToken, authController.me);

/**
 * POST /auth/switch-portal
 * Body: { portal: 'admin' | 'staff' } (lecturer alias of staff)
 * Requires: cookie or Bearer token. Only DB-role admins.
 */
router.post('/switch-portal', verifyToken, authController.switchPortal);

/**
 * POST /auth/refresh-session
 * Re-issues JWT from current DB capability flags (same portal when still allowed).
 */
router.post('/refresh-session', verifyToken, authController.refreshSession);

/**
 * POST /auth/change-password
 * Body: { encryptedCurrentPassword, encryptedNewPassword } (same encryption as login).
 * Requires: cookie or Bearer token.
 */
router.post(
  '/change-password',
  verifyToken,
  validateChangePasswordBody,
  authController.changePassword
);

/**
 * POST /auth/logout
 * Clears cookie.
 */
router.post('/logout', authController.logout);

export { router as authRouter };

