import { Router } from 'express';
import { verifyToken, authorizeRole } from '../middleware/auth.middleware.js';
import * as lecturerAccountController from '../controllers/lecturerAccount.controller.js';

const router = Router();

router.get(
  '/lecturer/account/profile',
  verifyToken,
  authorizeRole('lecturer'),
  lecturerAccountController.getProfile
);

export { router as lecturerAccountRouter };
