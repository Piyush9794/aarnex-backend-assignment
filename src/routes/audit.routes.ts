import { Router } from 'express';
import { AuditController } from '../controllers/AuditController';
import { authenticate } from '../middleware/authenticate';
import { requireRole } from '../middleware/authorize';
import { validateQuery } from '../middleware/validate';
import { auditLogQuerySchema } from '../validators';
import { UserRole } from '../models/User';

const router = Router();

router.use(authenticate);

// Accessible by SUPER_ADMIN and BRANCH_MANAGER
router.get(
  '/',
  requireRole(UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER),
  validateQuery(auditLogQuerySchema),
  AuditController.getLogs
);

export default router;
