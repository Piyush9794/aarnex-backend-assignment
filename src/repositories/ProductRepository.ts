import { AppDataSource } from '../config/database';
import { Product } from '../models/Product';
import { ILike } from 'typeorm';

export const ProductRepository = AppDataSource.getRepository(Product).extend({
  async findWithFilters(search?: string, page = 1, limit = 20): Promise<[Product[], number]> {
    const where = search
      ? [{ name: ILike(`%${search}%`) }, { sku: ILike(`%${search}%`) }]
      : {};

    return this.findAndCount({
      where,
      skip: (page - 1) * limit,
      take: limit,
      order: { created_at: 'DESC' },
    });
  },

  async findActiveById(id: string): Promise<Product | null> {
    return this.findOne({
      where: { id, is_active: true },
    });
  },
});
