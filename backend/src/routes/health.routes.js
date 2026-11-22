import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.get(
  '/',
  asyncHandler(async (req, res) => {
    res.status(200).json({
      success: true,
      message: 'Edu ERP API is running',
      data: { timestamp: new Date().toISOString() },
    });
  })
);

export { router as healthRouter };
