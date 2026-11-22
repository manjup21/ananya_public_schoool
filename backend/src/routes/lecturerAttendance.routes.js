import { Router } from 'express';
import { verifyToken, authorizeStaffOrOperationalAdmin } from '../middleware/auth.middleware.js';
import * as lecturerAttendanceController from '../controllers/lecturerAttendance.controller.js';
import {
  validateBulkMarkAbsent,
  validateCancelSlot,
  validateDayContextQuery,
  validateRosterQuery,
} from '../middleware/lecturerAttendance.validation.js';

const router = Router();

// Per-route auth only — this router is mounted at the API root.
const staffOrAdmin = [verifyToken, authorizeStaffOrOperationalAdmin];

router.get(
  '/attendance/day-context',
  ...staffOrAdmin,
  validateDayContextQuery,
  lecturerAttendanceController.getDayContext
);
router.get('/attendance/roster', ...staffOrAdmin, validateRosterQuery, lecturerAttendanceController.getRoster);
router.post(
  '/attendance/absences/bulk',
  ...staffOrAdmin,
  validateBulkMarkAbsent,
  lecturerAttendanceController.bulkMarkAbsent
);
router.post(
  '/attendance/absences/bulk-unmark',
  ...staffOrAdmin,
  validateBulkMarkAbsent,
  lecturerAttendanceController.bulkUnmarkAbsent
);
router.post(
  '/attendance/cancel-slot',
  ...staffOrAdmin,
  validateCancelSlot,
  lecturerAttendanceController.cancelSlot
);
router.post(
  '/attendance/uncancel-slot',
  ...staffOrAdmin,
  validateCancelSlot,
  lecturerAttendanceController.uncancelSlot
);

export { router as lecturerAttendanceRouter };
