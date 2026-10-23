import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../models/User';
import { ForbiddenError, UnauthorizedError } from '../utils/errors';

export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new ForbiddenError(
          `User role ${req.user.role} is not authorized to perform this action`
        )
      );
    }

    next();
  };
}

export function enforceBranchScope(targetBranchId: string | null | undefined, req: Request): void {
  if (!req.user) {
    throw new UnauthorizedError('Authentication required');
  }

  // SUPER_ADMIN has global access across all branches
  if (req.user.role === UserRole.SUPER_ADMIN) {
    return;
  }

  // BRANCH_MANAGER and STAFF can only access their own branch
  if (!targetBranchId || req.user.branchId !== targetBranchId) {
    throw new ForbiddenError(
      'Access forbidden: You cannot access or modify resources belonging to another branch'
    );
  }
}
