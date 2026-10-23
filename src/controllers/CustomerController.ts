import { Request, Response, NextFunction } from 'express';
import { CustomerService } from '../services/CustomerService';
import { sendSuccess } from '../utils/response';

export class CustomerController {
  public static async getCustomers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { branch_id, page, limit } = req.query as {
        branch_id?: string;
        page?: string;
        limit?: string;
      };
      const result = await CustomerService.getCustomers(
        { role: req.user!.role, branchId: req.user!.branchId },
        branch_id,
        page ? Number(page) : 1,
        limit ? Number(limit) : 20
      );
      sendSuccess(res, result.customers, 'Customers retrieved successfully', 200, {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      });
    } catch (error) {
      next(error);
    }
  }

  public static async createCustomer(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const customer = await CustomerService.createCustomer(req.body, {
        userId: req.user!.userId,
        email: req.user!.email,
        role: req.user!.role,
        branchId: req.user!.branchId,
      });
      sendSuccess(res, customer, 'Customer created successfully', 201);
    } catch (error) {
      next(error);
    }
  }
}
