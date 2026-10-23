import { Request, Response, NextFunction } from 'express';
import { UserService } from '../services/UserService';
import { sendSuccess } from '../utils/response';

export class UserController {
  public static async createUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await UserService.createUser(req.body, req.user?.userId, req.user?.email);
      sendSuccess(res, user, 'User created successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  public static async updateUserStatus(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      const { is_active } = req.body;
      const user = await UserService.updateUserStatus(
        id,
        is_active,
        req.user?.userId,
        req.user?.email
      );
      sendSuccess(res, user, 'User status updated successfully', 200);
    } catch (error) {
      next(error);
    }
  }
}
