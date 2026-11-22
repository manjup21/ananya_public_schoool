import { Router } from 'express';
import { verifyToken, requireOperationalAdmin } from '../middleware/auth.middleware.js';
import * as studentController from '../controllers/student.controller.js';
import { validateCreateStudent, validateStudentIdParam, validateUpdateStudent } from '../middleware/student.validation.js';
import { uploadStudentPhotoMiddleware } from '../middleware/studentPhoto.middleware.js';

const router = Router();

router.use(verifyToken);

router.get('/students', requireOperationalAdmin, studentController.getStudents);
router.post('/students', requireOperationalAdmin, validateCreateStudent, studentController.createStudent);
router.get('/students/:id/photo', requireOperationalAdmin, validateStudentIdParam, studentController.getStudentPhoto);
router.post(
  '/students/:id/photo',
  requireOperationalAdmin,
  validateStudentIdParam,
  uploadStudentPhotoMiddleware,
  studentController.uploadStudentPhoto
);
router.delete('/students/:id/photo', requireOperationalAdmin, validateStudentIdParam, studentController.deleteStudentPhoto);
router.get('/students/:id', requireOperationalAdmin, validateStudentIdParam, studentController.getStudentById);
router.put('/students/:id', requireOperationalAdmin, validateStudentIdParam, validateUpdateStudent, studentController.updateStudent);
router.delete('/students/:id', requireOperationalAdmin, validateStudentIdParam, studentController.deleteStudent);
router.post('/students/:id/restore', requireOperationalAdmin, validateStudentIdParam, studentController.restoreStudent);
router.post('/students/:id/toggle-status', requireOperationalAdmin, validateStudentIdParam, studentController.toggleStudentStatus);

export { router as studentRouter };
