import { Router } from 'express';
import { verifyToken, requireOperationalAdmin, authorizeStaffOrOperationalAdmin } from '../middleware/auth.middleware.js';
import * as dashboardController from '../controllers/dashboard.controller.js';
import { validateDashboardRange } from '../middleware/dashboard.validation.js';

const router = Router();

router.use(verifyToken);

router.get(
  '/dashboard/admin',
  requireOperationalAdmin,
  validateDashboardRange,
  dashboardController.getAdminDashboard
);

router.get(
  '/dashboard/lecturer',
  authorizeStaffOrOperationalAdmin,
  validateDashboardRange,
  dashboardController.getLecturerDashboard
);

export { router as dashboardRouter };
