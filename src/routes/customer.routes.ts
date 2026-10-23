import { Router } from 'express';
import { CustomerController } from '../controllers/CustomerController';
import { authenticate } from '../middleware/authenticate';
import { validateBody, validateQuery } from '../middleware/validate';
import { createCustomerSchema, customerQuerySchema } from '../validators';

const router = Router();

router.use(authenticate);

router.get('/', validateQuery(customerQuerySchema), CustomerController.getCustomers);
router.post('/', validateBody(createCustomerSchema), CustomerController.createCustomer);

export default router;
