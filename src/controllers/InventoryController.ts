import { Request, Response, NextFunction } from 'express';
import { InventoryService } from '../services/InventoryService';
import { sendSuccess } from '../utils/response';

export class InventoryController {
  public static async getBranchInventory(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      const inventory = await InventoryService.getBranchInventory(id, {
        role: req.user!.role,
        branchId: req.user!.branchId,
      });
      sendSuccess(res, inventory, 'Branch inventory retrieved successfully', 200);
    } catch (error) {
      next(error);
    }
  }

  public static async adjustInventory(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      const result = await InventoryService.adjustInventory(id, req.body, {
        userId: req.user!.userId,
        email: req.user!.email,
        role: req.user!.role,
        branchId: req.user!.branchId,
      });
      sendSuccess(res, result, 'Inventory adjusted successfully', 200);
    } catch (error) {
      next(error);
    }
  }
}
