import { Router } from 'express';
import * as userController from '../controllers/user.controller.js';
import { verifyToken, requireSuperAdmin } from '../middleware/auth.middleware.js';
import {
  validateCreateUser,
  validateUpdateUser,
  validateUserIdParam,
  validateGetUsersQuery,
} from '../middleware/user.validation.js';

const router = Router();

router.use(verifyToken);
router.use(requireSuperAdmin);

router.post('/', validateCreateUser, userController.createUser);
router.put('/:id', validateUpdateUser, userController.updateUser);
router.delete('/:id', validateUserIdParam, userController.deleteUser);
router.get('/', validateGetUsersQuery, userController.getUsers);

export { router as userRouter };
