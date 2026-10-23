import { Request, Response, NextFunction } from 'express';
import { ProductService } from '../services/ProductService';
import { sendSuccess } from '../utils/response';

export class ProductController {
  public static async getProducts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { search, page, limit } = req.query as {
        search?: string;
        page?: string;
        limit?: string;
      };
      const result = await ProductService.getProducts(
        search,
        page ? Number(page) : 1,
        limit ? Number(limit) : 20
      );
      sendSuccess(res, result.products, 'Products retrieved successfully', 200, {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      });
    } catch (error) {
      next(error);
    }
  }

  public static async getProductById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const product = await ProductService.getProductById(req.params.id);
      sendSuccess(res, product, 'Product retrieved successfully', 200);
    } catch (error) {
      next(error);
    }
  }

  public static async createProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const product = await ProductService.createProduct(
        req.body,
        req.user?.userId,
        req.user?.email
      );
      sendSuccess(res, product, 'Product created successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  public static async updateProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const product = await ProductService.updateProduct(
        req.params.id,
        req.body,
        req.user?.userId,
        req.user?.email
      );
      sendSuccess(res, product, 'Product updated successfully', 200);
    } catch (error) {
      next(error);
    }
  }
}
