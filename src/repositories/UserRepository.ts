import { AppDataSource } from '../config/database';
import { User } from '../models/User';

export const UserRepository = AppDataSource.getRepository(User).extend({
  async findByEmailWithPassword(email: string): Promise<User | null> {
    return this.createQueryBuilder('user')
      .addSelect('user.password_hash')
      .leftJoinAndSelect('user.branch', 'branch')
      .where('user.email = :email', { email })
      .getOne();
  },

  async findActiveById(id: string): Promise<User | null> {
    return this.findOne({
      where: { id, is_active: true },
      relations: ['branch'],
    });
  },
});
