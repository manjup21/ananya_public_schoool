import { Router } from 'express';
import { verifyToken, authorizeStaffOperationalOrFeeManager, requireOperationalAdmin } from '../middleware/auth.middleware.js';
import * as classSectionController from '../controllers/classSection.controller.js';
import {
  validateClassIdParam,
  validateCreateClass,
  validateSectionCodeBody,
  validateSectionIdParam,
  validateUpdateClass,
} from '../middleware/classSection.validation.js';

const router = Router();

router.use(verifyToken);

router.get('/classes', authorizeStaffOperationalOrFeeManager, classSectionController.getClasses);
router.post('/classes', requireOperationalAdmin, validateCreateClass, classSectionController.createClass);
router.put('/classes/:classId', requireOperationalAdmin, validateClassIdParam, validateUpdateClass, classSectionController.updateClass);
router.delete('/classes/:classId', requireOperationalAdmin, validateClassIdParam, classSectionController.deleteClass);
router.post(
  '/classes/:classId/sections',
  requireOperationalAdmin,
  validateClassIdParam,
  validateSectionCodeBody,
  classSectionController.createSection
);
router.put(
  '/sections/:sectionId',
  requireOperationalAdmin,
  validateSectionIdParam,
  validateSectionCodeBody,
  classSectionController.updateSection
);
router.delete('/sections/:sectionId', requireOperationalAdmin, validateSectionIdParam, classSectionController.deleteSection);

export { router as classSectionRouter };
