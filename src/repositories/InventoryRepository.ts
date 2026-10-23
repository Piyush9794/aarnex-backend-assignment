import { AppDataSource } from '../config/database';
import { Inventory } from '../models/Inventory';

export const InventoryRepository = AppDataSource.getRepository(Inventory).extend({
  async findByBranchWithProducts(branchId: string): Promise<Inventory[]> {
    return this.find({
      where: { branch_id: branchId },
      relations: ['product', 'branch'],
      order: { created_at: 'ASC' },
    });
  },

  async findByBranchAndProduct(branchId: string, productId: string): Promise<Inventory | null> {
    return this.findOne({
      where: { branch_id: branchId, product_id: productId },
      relations: ['product'],
    });
  },
});
