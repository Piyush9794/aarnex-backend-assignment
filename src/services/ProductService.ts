import { AppDataSource } from '../config/database';
import { Product } from '../models/Product';
import { ConflictError, NotFoundError } from '../utils/errors';
import { ILike } from 'typeorm';
import { AuditService } from './AuditService';

export interface CreateProductDTO {
  sku: string;
  name: string;
  description?: string | null;
  price_paise: number;
}

export interface UpdateProductDTO {
  name?: string;
  description?: string | null;
  price_paise?: number;
  is_active?: boolean;
}

export class ProductService {
  public static async getProducts(
    search?: string,
    page = 1,
    limit = 20
  ): Promise<{ products: Product[]; total: number; page: number; limit: number; totalPages: number }> {
    const productRepo = AppDataSource.getRepository(Product);

    const where = search
      ? [{ name: ILike(`%${search}%`) }, { sku: ILike(`%${search}%`) }]
      : {};

    const [products, total] = await productRepo.findAndCount({
      where,
      skip: (page - 1) * limit,
      take: limit,
      order: { created_at: 'DESC' },
    });

    return {
      products,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  public static async getProductById(id: string): Promise<Product> {
    const productRepo = AppDataSource.getRepository(Product);
    const product = await productRepo.findOne({ where: { id } });
    if (!product) {
      throw new NotFoundError(`Product with ID ${id} not found`);
    }
    return product;
  }

  public static async createProduct(
    dto: CreateProductDTO,
    actorId?: string,
    actorEmail?: string
  ): Promise<Product> {
    const productRepo = AppDataSource.getRepository(Product);

    const existing = await productRepo.findOne({ where: { sku: dto.sku.toUpperCase() } });
    if (existing) {
      throw new ConflictError(`Product with SKU '${dto.sku}' already exists`);
    }

    const product = productRepo.create({
      sku: dto.sku.toUpperCase(),
      name: dto.name,
      description: dto.description || null,
      price_paise: dto.price_paise,
      is_active: true,
    });

    const saved = await productRepo.save(product);

    await AuditService.recordLog({
      actor_id: actorId,
      actor_email: actorEmail,
      action: 'PRODUCT_CREATED',
      entity_type: 'Product',
      entity_id: saved.id,
      metadata: { sku: saved.sku, price_paise: saved.price_paise },
    });

    return saved;
  }

  public static async updateProduct(
    id: string,
    dto: UpdateProductDTO,
    actorId?: string,
    actorEmail?: string
  ): Promise<Product> {
    const productRepo = AppDataSource.getRepository(Product);
    const product = await productRepo.findOne({ where: { id } });

    if (!product) {
      throw new NotFoundError(`Product with ID ${id} not found`);
    }

    if (dto.name !== undefined) product.name = dto.name;
    if (dto.description !== undefined) product.description = dto.description;
    if (dto.price_paise !== undefined) product.price_paise = dto.price_paise;
    if (dto.is_active !== undefined) product.is_active = dto.is_active;

    const saved = await productRepo.save(product);

    await AuditService.recordLog({
      actor_id: actorId,
      actor_email: actorEmail,
      action: 'PRODUCT_UPDATED',
      entity_type: 'Product',
      entity_id: saved.id,
      metadata: dto as Record<string, unknown>,
    });

    return saved;
  }
}
