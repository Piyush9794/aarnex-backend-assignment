import { Request, Response, NextFunction } from 'express';
import { OrderService } from '../services/OrderService';
import { sendSuccess } from '../utils/response';
import { OrderStatus } from '../models/Order';

export class OrderController {
  public static async createOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const order = await OrderService.createOrder(req.body, {
        userId: req.user!.userId,
        email: req.user!.email,
        role: req.user!.role,
        branchId: req.user!.branchId,
      });
      sendSuccess(res, order, 'Order created successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  public static async getOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { branch_id, status, page, limit } = req.query as {
        branch_id?: string;
        status?: OrderStatus;
        page?: string;
        limit?: string;
      };

      const result = await OrderService.getOrders(
        { branch_id, status },
        { role: req.user!.role, branchId: req.user!.branchId },
        page ? Number(page) : 1,
        limit ? Number(limit) : 20
      );

      sendSuccess(res, result.orders, 'Orders retrieved successfully', 200, {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      });
    } catch (error) {
      next(error);
    }
  }

  public static async getOrderById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const order = await OrderService.getOrderById(req.params.id, {
        role: req.user!.role,
        branchId: req.user!.branchId,
      });
      sendSuccess(res, order, 'Order retrieved successfully', 200);
    } catch (error) {
      next(error);
    }
  }

  public static async updateOrderStatus(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { status } = req.body;
      const order = await OrderService.updateOrderStatus(req.params.id, status, {
        userId: req.user!.userId,
        email: req.user!.email,
        role: req.user!.role,
        branchId: req.user!.branchId,
      });
      sendSuccess(res, order, 'Order status updated successfully', 200);
    } catch (error) {
      next(error);
    }
  }

  public static async cancelOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { reason } = req.body;
      const order = await OrderService.cancelOrder(req.params.id, reason, {
        userId: req.user!.userId,
        email: req.user!.email,
        role: req.user!.role,
        branchId: req.user!.branchId,
      });
      sendSuccess(res, order, 'Order cancelled successfully', 200);
    } catch (error) {
      next(error);
    }
  }
}
