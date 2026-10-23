import { Router } from 'express';
import { UserController } from '../controllers/UserController';
import { authenticate } from '../middleware/authenticate';
import { requireRole } from '../middleware/authorize';
import { validateBody } from '../middleware/validate';
import { createUserSchema, updateUserStatusSchema } from '../validators';
import { UserRole } from '../models/User';

const router = Router();

// Only SUPER_ADMIN can create users or alter their status
router.use(authenticate, requireRole(UserRole.SUPER_ADMIN));

router.post('/', validateBody(createUserSchema), UserController.createUser);
router.patch('/:id/status', validateBody(updateUserStatusSchema), UserController.updateUserStatus);

export default router;
