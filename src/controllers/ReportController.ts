import { Request, Response, NextFunction } from 'express';
import { ReportService } from '../services/ReportService';
import { sendSuccess } from '../utils/response';

export class ReportController {
  public static async getBranchSummary(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      const { from, to } = req.query as { from: string; to: string };

      const summary = await ReportService.getBranchSummary(id, from, to, {
        role: req.user!.role,
        branchId: req.user!.branchId,
      });

      sendSuccess(res, summary, 'Branch summary report generated successfully', 200);
    } catch (error) {
      next(error);
    }
  }
}
