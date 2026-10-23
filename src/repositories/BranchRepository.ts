import { AppDataSource } from '../config/database';
import { Branch } from '../models/Branch';

export const BranchRepository = AppDataSource.getRepository(Branch).extend({
  async findActiveBranches(): Promise<Branch[]> {
    return this.find({
      where: { is_active: true },
      order: { name: 'ASC' },
    });
  },

  async findByCode(code: string): Promise<Branch | null> {
    return this.findOne({ where: { code } });
  },
});
