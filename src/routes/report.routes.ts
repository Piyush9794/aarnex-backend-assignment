import { Router } from 'express';
import { ReportController } from '../controllers/ReportController';
import { authenticate } from '../middleware/authenticate';
import { requireRole } from '../middleware/authorize';
import { validateQuery } from '../middleware/validate';
import { reportSummaryQuerySchema } from '../validators';
import { UserRole } from '../models/User';

const router = Router();

router.use(authenticate);

// Reports accessible to SUPER_ADMIN and BRANCH_MANAGER (with branch isolation)
router.get(
  '/branches/:id/summary',
  requireRole(UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER),
  validateQuery(reportSummaryQuerySchema),
  ReportController.getBranchSummary
);

export default router;
