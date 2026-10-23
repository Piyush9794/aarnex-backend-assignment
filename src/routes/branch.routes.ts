import { Router } from 'express';
import { BranchController } from '../controllers/BranchController';
import { authenticate } from '../middleware/authenticate';
import { requireRole } from '../middleware/authorize';
import { validateBody } from '../middleware/validate';
import { createBranchSchema } from '../validators';
import { UserRole } from '../models/User';

const router = Router();

// All branch routes require authentication
router.use(authenticate);

router.get('/', BranchController.getAllBranches);
router.post(
  '/',
  requireRole(UserRole.SUPER_ADMIN),
  validateBody(createBranchSchema),
  BranchController.createBranch
);

export default router;
