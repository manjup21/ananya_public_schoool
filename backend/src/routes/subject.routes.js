import { Router } from 'express';
import { verifyToken, authorizeStaffOrOperationalAdmin, requireOperationalAdmin } from '../middleware/auth.middleware.js';
import * as subjectController from '../controllers/subject.controller.js';
import { validateCreateSubject, validateReorderSubjects, validateSubjectIdParam, validateUpdateSubject } from '../middleware/subject.validation.js';

const router = Router();

router.use(verifyToken);

router.get('/subjects', authorizeStaffOrOperationalAdmin, subjectController.getSubjects);
router.put('/subjects/reorder', requireOperationalAdmin, validateReorderSubjects, subjectController.reorderSubjects);
router.post('/subjects', requireOperationalAdmin, validateCreateSubject, subjectController.createSubject);
router.put('/subjects/:id', requireOperationalAdmin, validateSubjectIdParam, validateUpdateSubject, subjectController.updateSubject);
router.delete('/subjects/:id', requireOperationalAdmin, validateSubjectIdParam, subjectController.deleteSubject);
router.post('/subjects/:id/restore', requireOperationalAdmin, validateSubjectIdParam, subjectController.restoreSubject);
router.post('/subjects/:id/toggle-status', requireOperationalAdmin, validateSubjectIdParam, subjectController.toggleSubjectStatus);

export { router as subjectRouter };
