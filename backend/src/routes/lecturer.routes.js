import { Router } from 'express';
import { verifyToken, requireSuperAdmin } from '../middleware/auth.middleware.js';
import * as lecturerController from '../controllers/lecturer.controller.js';
import {
  validateCreateLecturer,
  validateGetLecturersQuery,
  validateLecturerIdParam,
  validateUpdateLecturer,
} from '../middleware/lecturer.validation.js';

const router = Router();

router.use(verifyToken, requireSuperAdmin);

router.post('/', validateCreateLecturer, lecturerController.createLecturer);
router.get('/', validateGetLecturersQuery, lecturerController.getLecturers);
router.get('/:id', validateLecturerIdParam, lecturerController.getLecturerById);
router.put('/:id', validateLecturerIdParam, validateUpdateLecturer, lecturerController.updateLecturer);
router.delete('/:id', validateLecturerIdParam, lecturerController.deleteLecturer);
router.post('/:id/reset-password', validateLecturerIdParam, lecturerController.resetLecturerPassword);

export { router as lecturerRouter };
