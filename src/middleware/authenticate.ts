import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt';
import { UnauthorizedError } from '../utils/errors';
import { AppDataSource } from '../config/database';
import { User } from '../models/User';

export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Authentication token is missing or malformed');
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      throw new UnauthorizedError('Bearer token is empty');
    }

    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch {
      throw new UnauthorizedError('Invalid or expired authentication token', 'INVALID_TOKEN');
    }

    // Verify active user in database to ensure deactivated users cannot authenticate
    const userRepo = AppDataSource.getRepository(User);
    const user = await userRepo.findOne({
      where: { id: payload.userId },
      select: ['id', 'email', 'role', 'branch_id', 'is_active'],
    });

    if (!user) {
      throw new UnauthorizedError('Authenticated user no longer exists', 'USER_NOT_FOUND');
    }

    if (!user.is_active) {
      throw new UnauthorizedError('User account has been deactivated', 'ACCOUNT_DEACTIVATED');
    }

    req.user = {
      userId: user.id,
      email: user.email,
      role: user.role,
      branchId: user.branch_id,
    };

    next();
  } catch (error) {
    next(error);
  }
}
