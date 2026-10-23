import { Router } from 'express';
import { ProductController } from '../controllers/ProductController';
import { authenticate } from '../middleware/authenticate';
import { requireRole } from '../middleware/authorize';
import { validateBody, validateQuery } from '../middleware/validate';
import { createProductSchema, updateProductSchema, productQuerySchema } from '../validators';
import { UserRole } from '../models/User';

const router = Router();

router.use(authenticate);

router.get('/', validateQuery(productQuerySchema), ProductController.getProducts);
router.get('/:id', ProductController.getProductById);

router.post(
  '/',
  requireRole(UserRole.SUPER_ADMIN),
  validateBody(createProductSchema),
  ProductController.createProduct
);

router.patch(
  '/:id',
  requireRole(UserRole.SUPER_ADMIN),
  validateBody(updateProductSchema),
  ProductController.updateProduct
);

export default router;
