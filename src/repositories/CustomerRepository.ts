import { AppDataSource } from '../config/database';
import { Customer } from '../models/Customer';

export const CustomerRepository = AppDataSource.getRepository(Customer).extend({
  async findByBranch(branchId: string, page = 1, limit = 20): Promise<[Customer[], number]> {
    return this.findAndCount({
      where: { branch_id: branchId },
      relations: ['branch'],
      skip: (page - 1) * limit,
      take: limit,
      order: { created_at: 'DESC' },
    });
  },

  async findInBranch(id: string, branchId: string): Promise<Customer | null> {
    return this.findOne({
      where: { id, branch_id: branchId },
      relations: ['branch'],
    });
  },
});
