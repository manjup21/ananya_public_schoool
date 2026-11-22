import { Router } from 'express';
import { verifyToken, authorizeFeeManager } from '../middleware/auth.middleware.js';
import * as feeController from '../controllers/fee.controller.js';
import {
  validateAssignFee,
  validateBulkAssignFee,
  validateRecordPayment,
  validateStudentIdParam,
  validatePaymentIdParam,
  validateFeeItemIdParam,
  validateAcademicYearQuery,
} from '../middleware/fee.validation.js';

const router = Router();

// Per-route auth only — this router is mounted at the API root; blanket authorizeFeeManager
// would block non-fee users from later routers (e.g. /notifications).
const feeAuth = [verifyToken, authorizeFeeManager];

router.post('/fees/assign', ...feeAuth, validateAssignFee, feeController.assignFee);
router.post('/fees/bulk-assign', ...feeAuth, validateBulkAssignFee, feeController.bulkAssignFee);
router.post('/fees/payments', ...feeAuth, validateRecordPayment, feeController.recordPayment);
router.get('/fees/students', ...feeAuth, validateAcademicYearQuery, feeController.listStudentFees);
router.get('/fees/students/:studentId', ...feeAuth, validateStudentIdParam, feeController.getStudentFee);
router.get(
  '/fees/students/:studentId/payments',
  ...feeAuth,
  validateStudentIdParam,
  feeController.getPaymentHistory
);
router.delete('/fees/payments/:paymentId', ...feeAuth, validatePaymentIdParam, feeController.deletePayment);
router.delete('/fees/items/:itemId', ...feeAuth, validateFeeItemIdParam, feeController.deleteFeeItem);
router.get('/fees/dashboard', ...feeAuth, feeController.getDashboardSummary);

export { router as feeRouter };
