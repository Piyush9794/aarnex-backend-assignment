import { AppDataSource } from '../config/database';
import { Inventory } from '../models/Inventory';
import { StockMovement, StockMovementReason } from '../models/StockMovement';
import { Branch } from '../models/Branch';
import { Product } from '../models/Product';
import { UserRole } from '../models/User';
import { ConflictError, ForbiddenError, NotFoundError } from '../utils/errors';
import { AuditService } from './AuditService';

export interface InventoryAdjustmentDTO {
  product_id: string;
  quantity_change: number; // Signed integer: positive to add stock, negative to reduce
  reason: string;
}

export class InventoryService {
  public static async getBranchInventory(
    branchId: string,
    currentUser: { role: UserRole; branchId: string | null }
  ): Promise<Inventory[]> {
    // Branch isolation check: non-superadmins can only view their own branch inventory
    if (currentUser.role !== UserRole.SUPER_ADMIN && currentUser.branchId !== branchId) {
      throw new ForbiddenError('Access forbidden: Cannot view inventory of another branch');
    }

    const branchRepo = AppDataSource.getRepository(Branch);
    const branch = await branchRepo.findOne({ where: { id: branchId } });
    if (!branch) {
      throw new NotFoundError(`Branch with ID ${branchId} not found`);
    }

    const inventoryRepo = AppDataSource.getRepository(Inventory);
    return inventoryRepo.find({
      where: { branch_id: branchId },
      relations: ['product'],
      order: { created_at: 'ASC' },
    });
  }

  public static async adjustInventory(
    branchId: string,
    dto: InventoryAdjustmentDTO,
    currentUser: { userId: string; email: string; role: UserRole; branchId: string | null }
  ): Promise<{ inventory: Inventory; movement: StockMovement }> {
    // 1. Authorization checks
    if (currentUser.role === UserRole.STAFF) {
      throw new ForbiddenError('Staff members are not authorized to adjust inventory');
    }

    if (currentUser.role === UserRole.BRANCH_MANAGER && currentUser.branchId !== branchId) {
      throw new ForbiddenError('Branch managers can adjust inventory only for their own branch');
    }

    const branchRepo = AppDataSource.getRepository(Branch);
    const branch = await branchRepo.findOne({ where: { id: branchId } });
    if (!branch) {
      throw new NotFoundError(`Branch with ID ${branchId} not found`);
    }

    const productRepo = AppDataSource.getRepository(Product);
    const product = await productRepo.findOne({ where: { id: dto.product_id } });
    if (!product) {
      throw new NotFoundError(`Product with ID ${dto.product_id} not found`);
    }

    // 2. Transaction with pessimistic row-level locking
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Pessimistic write lock: SELECT ... FOR UPDATE
      let inventory = await queryRunner.manager
        .createQueryBuilder(Inventory, 'inv')
        .setLock('pessimistic_write')
        .where('inv.branch_id = :branchId AND inv.product_id = :productId', {
          branchId,
          productId: dto.product_id,
        })
        .getOne();

      let currentQty = inventory ? inventory.quantity : 0;
      const newQty = currentQty + dto.quantity_change;

      if (newQty < 0) {
        throw new ConflictError(
          `Insufficient stock for adjustment. Current stock: ${currentQty}, Requested change: ${dto.quantity_change}`
        );
      }

      if (!inventory) {
        inventory = queryRunner.manager.create(Inventory, {
          branch_id: branchId,
          product_id: dto.product_id,
          quantity: newQty,
        });
      } else {
        inventory.quantity = newQty;
      }

      const savedInventory = await queryRunner.manager.save(Inventory, inventory);

      // Record Stock Movement
      const movement = queryRunner.manager.create(StockMovement, {
        branch_id: branchId,
        product_id: dto.product_id,
        quantity_change: dto.quantity_change,
        balance_after: newQty,
        reason: StockMovementReason.ADJUSTMENT,
        reference_id: dto.reason,
        actor_id: currentUser.userId,
      });
      const savedMovement = await queryRunner.manager.save(StockMovement, movement);

      // Record Audit Log within same transaction
      await AuditService.recordLog(
        {
          actor_id: currentUser.userId,
          actor_email: currentUser.email,
          action: 'INVENTORY_ADJUSTED',
          entity_type: 'Inventory',
          entity_id: savedInventory.id,
          branch_id: branchId,
          metadata: {
            product_id: dto.product_id,
            product_sku: product.sku,
            quantity_change: dto.quantity_change,
            balance_after: newQty,
            reason: dto.reason,
          },
        },
        queryRunner.manager
      );

      await queryRunner.commitTransaction();

      // Attach relations for clean response
      savedInventory.product = product;
      return { inventory: savedInventory, movement: savedMovement };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
