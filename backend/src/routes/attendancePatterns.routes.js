import { Router } from 'express';
import { verifyToken, requireOperationalAdmin } from '../middleware/auth.middleware.js';
import * as attendancePatternsController from '../controllers/attendancePatterns.controller.js';
import {
  validateAttendancePatternIdParam,
  validateCreateAttendancePattern,
  validateUpdateAttendancePattern,
  validateVersionAttendancePattern,
} from '../middleware/attendancePatterns.validation.js';

const router = Router();

router.use(verifyToken);

router.get('/attendance-patterns/resolve', requireOperationalAdmin, attendancePatternsController.resolveAttendancePattern);
router.get('/attendance-patterns', requireOperationalAdmin, attendancePatternsController.listAttendancePatterns);
router.post('/attendance-patterns', requireOperationalAdmin, validateCreateAttendancePattern, attendancePatternsController.createAttendancePattern);
router.get('/attendance-patterns/:id', requireOperationalAdmin, validateAttendancePatternIdParam, attendancePatternsController.getAttendancePatternById);
router.put(
  '/attendance-patterns/:id',
  requireOperationalAdmin,
  validateAttendancePatternIdParam,
  validateUpdateAttendancePattern,
  attendancePatternsController.updateAttendancePattern
);
router.post(
  '/attendance-patterns/:id/version',
  requireOperationalAdmin,
  validateAttendancePatternIdParam,
  validateVersionAttendancePattern,
  attendancePatternsController.versionAttendancePattern
);
router.delete(
  '/attendance-patterns/:id',
  requireOperationalAdmin,
  validateAttendancePatternIdParam,
  attendancePatternsController.deleteAttendancePattern
);

export { router as attendancePatternsRouter };
