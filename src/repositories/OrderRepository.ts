import { AppDataSource } from '../config/database';
import { Order, OrderStatus } from '../models/Order';

export const OrderRepository = AppDataSource.getRepository(Order).extend({
  async findWithDetails(id: string): Promise<Order | null> {
    return this.findOne({
      where: { id },
      relations: ['items', 'items.product', 'branch', 'customer', 'created_by'],
    });
  },

  async findOrders(
    filter: { branch_id?: string; status?: OrderStatus },
    page = 1,
    limit = 20
  ): Promise<[Order[], number]> {
    const qb = this.createQueryBuilder('order')
      .leftJoinAndSelect('order.customer', 'customer')
      .leftJoinAndSelect('order.branch', 'branch')
      .leftJoinAndSelect('order.items', 'items')
      .leftJoinAndSelect('items.product', 'product')
      .orderBy('order.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (filter.branch_id) {
      qb.andWhere('order.branch_id = :branchId', { branchId: filter.branch_id });
    }
    if (filter.status) {
      qb.andWhere('order.status = :status', { status: filter.status });
    }

    return qb.getManyAndCount();
  },
});
