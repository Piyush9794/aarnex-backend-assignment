import { Router } from 'express';
import { InventoryController } from '../controllers/InventoryController';
import { authenticate } from '../middleware/authenticate';
import { requireRole } from '../middleware/authorize';
import { validateBody } from '../middleware/validate';
import { inventoryAdjustmentSchema } from '../validators';
import { UserRole } from '../models/User';

const router = Router();

router.use(authenticate);

// Get branch inventory: SUPER_ADMIN, BRANCH_MANAGER, STAFF (own branch verified in service)
router.get('/:id/inventory', InventoryController.getBranchInventory);

// Adjust inventory: Only SUPER_ADMIN and BRANCH_MANAGER (STAFF explicitly forbidden!)
router.post(
  '/:id/inventory/adjustments',
  requireRole(UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER),
  validateBody(inventoryAdjustmentSchema),
  InventoryController.adjustInventory
);

export default router;
