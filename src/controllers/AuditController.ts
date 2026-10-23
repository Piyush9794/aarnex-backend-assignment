import { Request, Response, NextFunction } from 'express';
import { AuditService } from '../services/AuditService';
import { sendSuccess } from '../utils/response';
import { UserRole } from '../models/User';

export class AuditController {
  public static async getLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { entity_type, entity_id, action, page, limit } = req.query as {
        entity_type?: string;
        entity_id?: string;
        action?: string;
        page?: string;
        limit?: string;
      };

      // Branch isolation: non-superadmin only views logs for their own branch
      const branchId =
        req.user?.role === UserRole.SUPER_ADMIN ? undefined : req.user?.branchId || undefined;

      const [logs, total] = await AuditService.getLogs(
        { entity_type, entity_id, action, branch_id: branchId },
        page ? Number(page) : 1,
        limit ? Number(limit) : 50
      );

      sendSuccess(res, logs, 'Audit logs retrieved successfully', 200, {
        page: page ? Number(page) : 1,
        limit: limit ? Number(limit) : 50,
        total,
        totalPages: Math.ceil(total / (limit ? Number(limit) : 50)),
      });
    } catch (error) {
      next(error);
    }
  }
}
