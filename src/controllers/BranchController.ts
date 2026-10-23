import { Request, Response, NextFunction } from 'express';
import { BranchService } from '../services/BranchService';
import { sendSuccess } from '../utils/response';

export class BranchController {
  public static async getAllBranches(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const branches = await BranchService.getAllBranches();
      sendSuccess(res, branches, 'Branches retrieved successfully', 200);
    } catch (error) {
      next(error);
    }
  }

  public static async createBranch(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const branch = await BranchService.createBranch(
        req.body,
        req.user?.userId,
        req.user?.email
      );
      sendSuccess(res, branch, 'Branch created successfully', 201);
    } catch (error) {
      next(error);
    }
  }
}
