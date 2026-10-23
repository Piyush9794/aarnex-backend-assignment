import { z } from 'zod';
import { UserRole } from '../models/User';
import { OrderStatus } from '../models/Order';

// --- AUTH VALIDATORS ---
export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

// --- BRANCH VALIDATORS ---
export const createBranchSchema = z.object({
  name: z.string().min(2, 'Branch name must be at least 2 characters'),
  code: z.string().min(2, 'Branch code must be at least 2 characters').max(50),
  address: z.string().min(3, 'Address is required'),
  phone: z.string().min(5, 'Phone number is required'),
});

// --- USER VALIDATORS ---
export const createUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  full_name: z.string().min(2, 'Full name is required'),
  role: z.nativeEnum(UserRole, { errorMap: () => ({ message: 'Invalid user role' }) }),
  branch_id: z.string().uuid('Invalid branch UUID').optional().nullable(),
});

export const updateUserStatusSchema = z.object({
  is_active: z.boolean({ required_error: 'is_active boolean is required' }),
});

// --- PRODUCT VALIDATORS ---
export const createProductSchema = z.object({
  sku: z.string().min(2, 'SKU must be at least 2 characters'),
  name: z.string().min(2, 'Product name is required'),
  description: z.string().optional().nullable(),
  price_paise: z.number().int('Price must be an integer (in paise)').nonnegative('Price cannot be negative'),
});

export const updateProductSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional().nullable(),
  price_paise: z.number().int().nonnegative().optional(),
  is_active: z.boolean().optional(),
});

export const productQuerySchema = z.object({
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

// --- CUSTOMER VALIDATORS ---
export const createCustomerSchema = z.object({
  name: z.string().min(2, 'Customer name is required'),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(5, 'Phone number is required'),
  branch_id: z.string().uuid('Invalid branch UUID').optional(),
});

export const customerQuerySchema = z.object({
  branch_id: z.string().uuid().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

// --- INVENTORY VALIDATORS ---
export const inventoryAdjustmentSchema = z.object({
  product_id: z.string().uuid('Invalid product UUID'),
  quantity_change: z
    .number()
    .int('Quantity change must be an integer')
    .refine((val) => val !== 0, 'Quantity change cannot be zero'),
  reason: z.string().min(2, 'Adjustment reason is required'),
});

// --- ORDER VALIDATORS ---
export const createOrderItemSchema = z.object({
  product_id: z.string().uuid('Invalid product UUID'),
  quantity: z.number().int('Quantity must be an integer').positive('Quantity must be greater than zero'),
});

export const createOrderSchema = z.object({
  customer_id: z.string().uuid('Invalid customer UUID'),
  branch_id: z.string().uuid('Invalid branch UUID').optional(),
  items: z.array(createOrderItemSchema).min(1, 'Order must contain at least one item'),
});

export const updateOrderStatusSchema = z.object({
  status: z.enum([OrderStatus.PACKED, OrderStatus.DISPATCHED, OrderStatus.DELIVERED], {
    errorMap: () => ({ message: 'Status must be PACKED, DISPATCHED, or DELIVERED' }),
  }),
});

export const cancelOrderSchema = z.object({
  reason: z.string().min(2, 'Cancellation reason is required').optional(),
});

export const orderQuerySchema = z.object({
  branch_id: z.string().uuid().optional(),
  status: z.nativeEnum(OrderStatus).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

// --- REPORT & AUDIT VALIDATORS ---
export const reportSummaryQuerySchema = z.object({
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'from date must be in YYYY-MM-DD format'),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'to date must be in YYYY-MM-DD format'),
});

export const auditLogQuerySchema = z.object({
  entity_type: z.string().optional(),
  entity_id: z.string().optional(),
  action: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
});
