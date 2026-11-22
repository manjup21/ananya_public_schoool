import { Router } from 'express';
import { verifyToken, requireOperationalAdmin } from '../middleware/auth.middleware.js';
import * as notificationController from '../controllers/notification.controller.js';

const router = Router();

// Per-route auth only — this router is mounted at the API root; blanket
// requireOperationalAdmin would 403 fee-only / staff sessions on unmatched fall-through.
const adminAuth = [verifyToken, requireOperationalAdmin];

router.get('/notifications/attendance/summary', ...adminAuth, notificationController.getAttendanceSummary);
router.get('/notifications/attendance/detail', ...adminAuth, notificationController.getAttendanceDetail);
router.post('/notifications/attendance/send', ...adminAuth, notificationController.sendAttendanceNotification);
router.post(
  '/notifications/attendance/send-bulk',
  ...adminAuth,
  notificationController.sendBulkAttendanceNotification
);
router.get('/notifications/exam/list', ...adminAuth, notificationController.getExamNotificationList);
router.get('/notifications/exam/detail', ...adminAuth, notificationController.getExamNotificationDetail);
router.post('/notifications/exam/send', ...adminAuth, notificationController.sendExamNotification);
router.get('/notifications/fee-due/summary', ...adminAuth, notificationController.getFeeDueNotificationSummary);
router.get('/notifications/fee-due/detail', ...adminAuth, notificationController.getFeeDueNotificationDetail);
router.post('/notifications/fee-due/send', ...adminAuth, notificationController.sendFeeDueNotification);
router.post('/notifications/retry', ...adminAuth, notificationController.retryFailedNotifications);
router.get('/notifications/logs', ...adminAuth, notificationController.getNotificationLogs);

export { router as notificationRouter };
