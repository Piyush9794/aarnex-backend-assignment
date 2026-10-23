import { Router } from 'express';
import authRoutes from './auth.routes';
import userRoutes from './user.routes';
import branchRoutes from './branch.routes';
import productRoutes from './product.routes';
import customerRoutes from './customer.routes';
import inventoryRoutes from './inventory.routes';
import orderRoutes from './order.routes';
import reportRoutes from './report.routes';
import auditRoutes from './audit.routes';
import healthRoutes from './health.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/branches', branchRoutes);
router.use('/branches', inventoryRoutes); // Handles /branches/:id/inventory and /branches/:id/inventory/adjustments
router.use('/products', productRoutes);
router.use('/customers', customerRoutes);
router.use('/orders', orderRoutes);
router.use('/reports', reportRoutes);
router.use('/audit-logs', auditRoutes);
router.use('/health', healthRoutes);

export default router;
