import { Router } from 'express';
import {
  verifyToken,
  requireFullStaff,
  authorizeStaffOrOperationalAdmin,
} from '../middleware/auth.middleware.js';
import * as lecturerStudentsController from '../controllers/lecturerStudents.controller.js';
import { getStudentPhoto } from '../controllers/student.controller.js';
import {
  validateAttendanceSummaryQuery,
  validateBulkProgressReportBody,
  validateExamSummaryQuery,
  validateLecturerStudentsListQuery,
  validateProgressReportQuery,
  validateStudentIdParam,
} from '../middleware/lecturerStudents.validation.js';

const router = Router();

// Do NOT use router.use(requireFullStaff) here — this router is mounted at the API root,
// so blanket middleware would reject admin sessions on unrelated paths (e.g. /dashboard/admin).

// GET /lecturer/students?search=&classId=&sectionId=
router.get(
  '/lecturer/students',
  verifyToken,
  authorizeStaffOrOperationalAdmin,
  validateLecturerStudentsListQuery,
  lecturerStudentsController.listStudents
);

// POST /lecturer/students/exams/progress-report/bulk
// Keep this static path before the student-id routes.
router.post(
  '/lecturer/students/exams/progress-report/bulk',
  verifyToken,
  authorizeStaffOrOperationalAdmin,
  validateBulkProgressReportBody,
  lecturerStudentsController.getBulkProgressReports
);

// GET /lecturer/students/:id
router.get(
  '/lecturer/students/:id',
  verifyToken,
  requireFullStaff,
  validateStudentIdParam,
  lecturerStudentsController.getStudentById
);

// GET /lecturer/students/:id/photo
router.get(
  '/lecturer/students/:id/photo',
  verifyToken,
  requireFullStaff,
  validateStudentIdParam,
  getStudentPhoto
);

// GET /lecturer/students/:id/attendance/summary?from=&to=
router.get(
  '/lecturer/students/:id/attendance/summary',
  verifyToken,
  requireFullStaff,
  validateStudentIdParam,
  validateAttendanceSummaryQuery,
  lecturerStudentsController.getAttendanceSummary
);

// GET /lecturer/students/:id/attendance/absences?from=&to=
router.get(
  '/lecturer/students/:id/attendance/absences',
  verifyToken,
  requireFullStaff,
  validateStudentIdParam,
  validateAttendanceSummaryQuery,
  lecturerStudentsController.listAbsences
);

// GET /lecturer/students/:id/exams/summary?limit=&offset=&from=&to=&examTypeId=&chartLimit=
router.get(
  '/lecturer/students/:id/exams/summary',
  verifyToken,
  requireFullStaff,
  validateStudentIdParam,
  validateExamSummaryQuery,
  lecturerStudentsController.getExamSummary
);

// GET /lecturer/students/:id/exams/progress-report?from=&to=&examTypeId=
router.get(
  '/lecturer/students/:id/exams/progress-report',
  verifyToken,
  authorizeStaffOrOperationalAdmin,
  validateStudentIdParam,
  validateProgressReportQuery,
  lecturerStudentsController.getProgressReport
);

export { router as lecturerStudentsRouter };
