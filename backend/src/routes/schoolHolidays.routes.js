import { Router } from 'express';
import { verifyToken, requireOperationalAdmin } from '../middleware/auth.middleware.js';
import * as schoolHolidaysController from '../controllers/schoolHolidays.controller.js';
import {
  validateCreateSchoolHoliday,
  validateListSchoolHolidayQuery,
  validateSchoolHolidayIdParam,
  validateUpdateSchoolHoliday,
} from '../middleware/schoolHolidays.validation.js';

const router = Router();

router.use(verifyToken);

router.get('/school-holidays', requireOperationalAdmin, validateListSchoolHolidayQuery, schoolHolidaysController.listSchoolHolidays);
router.post('/school-holidays', requireOperationalAdmin, validateCreateSchoolHoliday, schoolHolidaysController.createSchoolHoliday);
router.put(
  '/school-holidays/:id',
  requireOperationalAdmin,
  validateSchoolHolidayIdParam,
  validateUpdateSchoolHoliday,
  schoolHolidaysController.updateSchoolHoliday
);
router.delete('/school-holidays/:id', requireOperationalAdmin, validateSchoolHolidayIdParam, schoolHolidaysController.deleteSchoolHoliday);

export { router as schoolHolidaysRouter };
