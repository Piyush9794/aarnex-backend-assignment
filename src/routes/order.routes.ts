import { Router } from 'express';
import { OrderController } from '../controllers/OrderController';
import { authenticate } from '../middleware/authenticate';
import { validateBody, validateQuery } from '../middleware/validate';
import {
  createOrderSchema,
  updateOrderStatusSchema,
  cancelOrderSchema,
  orderQuerySchema,
} from '../validators';

const router = Router();

router.use(authenticate);

router.post('/', validateBody(createOrderSchema), OrderController.createOrder);
router.get('/', validateQuery(orderQuerySchema), OrderController.getOrders);
router.get('/:id', OrderController.getOrderById);
router.patch('/:id/status', validateBody(updateOrderStatusSchema), OrderController.updateOrderStatus);
router.post('/:id/cancel', validateBody(cancelOrderSchema), OrderController.cancelOrder);

export default router;
