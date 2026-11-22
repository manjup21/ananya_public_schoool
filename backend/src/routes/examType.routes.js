import { Router } from 'express';
import { verifyToken, authorizeStaffOrOperationalAdmin, requireOperationalAdmin } from '../middleware/auth.middleware.js';
import * as examTypeController from '../controllers/examType.controller.js';
import {
  validateCreateExamType,
  validateExamTypeIdParam,
  validateReorderExamTypes,
  validateUpdateExamType,
} from '../middleware/examType.validation.js';

const router = Router();

router.use(verifyToken);

router.get('/exam-types', authorizeStaffOrOperationalAdmin, examTypeController.getExamTypes);
router.put('/exam-types/reorder', requireOperationalAdmin, validateReorderExamTypes, examTypeController.reorderExamTypes);
router.post('/exam-types', requireOperationalAdmin, validateCreateExamType, examTypeController.createExamType);
router.put('/exam-types/:id', requireOperationalAdmin, validateExamTypeIdParam, validateUpdateExamType, examTypeController.updateExamType);
router.delete('/exam-types/:id', requireOperationalAdmin, validateExamTypeIdParam, examTypeController.deleteExamType);

export { router as examTypeRouter };
