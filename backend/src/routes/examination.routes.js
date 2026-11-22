import { Router } from 'express';
import { verifyToken, authorizeStaffOrOperationalAdmin } from '../middleware/auth.middleware.js';
import * as examinationController from '../controllers/examination.controller.js';
import * as examResultsController from '../controllers/examResults.controller.js';
import { validateCreateExamination, validateExamIdParam, validateUpdateExamination } from '../middleware/examination.validation.js';
import { validateBulkSave, validateSaveStudentResult, validateStudentIdParam } from '../middleware/examResults.validation.js';

const router = Router();

// Per-route auth only — this router is mounted at the API root; blanket middleware
// would block fee-only staff from unrelated paths (e.g. /fees/*).
const staffOrAdmin = [verifyToken, authorizeStaffOrOperationalAdmin];

router.get('/examinations', ...staffOrAdmin, examinationController.getExaminations);
router.get(
  '/examinations/:id/marks-template',
  ...staffOrAdmin,
  validateExamIdParam,
  examinationController.getExamMarksTemplate
);
router.get(
  '/examinations/:id/hall-tickets',
  ...staffOrAdmin,
  validateExamIdParam,
  examinationController.getHallTicketRoster
);
router.get('/examinations/:id', ...staffOrAdmin, validateExamIdParam, examinationController.getExaminationById);
router.get('/examinations/:id/results', ...staffOrAdmin, validateExamIdParam, examResultsController.listResults);
router.get(
  '/examinations/:id/results/full',
  ...staffOrAdmin,
  validateExamIdParam,
  examResultsController.listResultsFull
);
router.get(
  '/examinations/:id/results/:studentId',
  ...staffOrAdmin,
  validateExamIdParam,
  validateStudentIdParam,
  examResultsController.getStudentResult
);
router.post(
  '/examinations/:id/results/save',
  ...staffOrAdmin,
  validateExamIdParam,
  validateSaveStudentResult,
  examResultsController.saveStudentResult
);
router.post(
  '/examinations/:id/results/bulk-save',
  ...staffOrAdmin,
  validateExamIdParam,
  validateBulkSave,
  examResultsController.bulkSaveResults
);
router.post(
  '/examinations/:id/results/submit',
  ...staffOrAdmin,
  validateExamIdParam,
  examResultsController.submitAllForExam
);
router.post(
  '/examinations/:id/results/publish',
  ...staffOrAdmin,
  validateExamIdParam,
  examResultsController.publishAllForExam
);
router.post('/examinations', ...staffOrAdmin, validateCreateExamination, examinationController.createExamination);
router.put(
  '/examinations/:id',
  ...staffOrAdmin,
  validateExamIdParam,
  validateUpdateExamination,
  examinationController.updateExamination
);
router.post(
  '/examinations/:id/cancel',
  ...staffOrAdmin,
  validateExamIdParam,
  examinationController.cancelExamination
);

export { router as examinationRouter };
