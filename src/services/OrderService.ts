import { AppDataSource } from '../config/database';
import { Order, OrderStatus } from '../models/Order';
import { OrderItem } from '../models/OrderItem';
import { Inventory } from '../models/Inventory';
import { StockMovement, StockMovementReason } from '../models/StockMovement';
import { Product } from '../models/Product';
import { Customer } from '../models/Customer';
import { Branch } from '../models/Branch';
import { UserRole } from '../models/User';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../utils/errors';
import { AuditService } from './AuditService';

export interface CreateOrderItemDTO {
  product_id: string;
  quantity: number;
}

export interface CreateOrderDTO {
  customer_id: string;
  branch_id?: string;
  items: CreateOrderItemDTO[];
}

export class OrderService {
  public static async createOrder(
    dto: CreateOrderDTO,
    currentUser: { userId: string; email: string; role: UserRole; branchId: string | null }
  ): Promise<Order> {
    // 1. Determine and validate branch scope
    let targetBranchId: string;
    if (currentUser.role === UserRole.SUPER_ADMIN) {
      if (!dto.branch_id) {
        throw new ValidationError('branch_id is required when creating an order as SUPER_ADMIN');
      }
      targetBranchId = dto.branch_id;
    } else {
      if (!currentUser.branchId) {
        throw new ForbiddenError('User is not assigned to any branch');
      }
      if (dto.branch_id && dto.branch_id !== currentUser.branchId) {
        throw new ForbiddenError('Cannot create order for another branch');
      }
      targetBranchId = currentUser.branchId;
    }

    const branch = await AppDataSource.getRepository(Branch).findOne({
      where: { id: targetBranchId },
    });
    if (!branch) {
      throw new NotFoundError(`Branch with ID ${targetBranchId} not found`);
    }

    // 2. Customer validation and branch-scope check
    const customer = await AppDataSource.getRepository(Customer).findOne({
      where: { id: dto.customer_id, branch_id: targetBranchId },
    });
    if (!customer) {
      throw new NotFoundError(
        `Customer with ID ${dto.customer_id} does not exist in branch '${branch.name}'`
      );
    }

    // 3. Consolidate and sort items deterministically to prevent deadlocks
    const itemMap = new Map<string, number>();
    for (const item of dto.items) {
      if (item.quantity <= 0) {
        throw new ValidationError('Item quantity must be greater than zero');
      }
      const existing = itemMap.get(item.product_id) || 0;
      itemMap.set(item.product_id, existing + item.quantity);
    }

    // Deterministic lexicographical sorting of product IDs
    const sortedProductIds = Array.from(itemMap.keys()).sort();

    // 4. Execute atomic transaction with pessimistic locking
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const orderNumber = `ORD-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
      let totalAmountPaise = 0;
      const orderItemsToSave: {
        product: Product;
        quantity: number;
        unit_price_paise: number;
        subtotal_paise: number;
      }[] = [];

      for (const productId of sortedProductIds) {
        const quantity = itemMap.get(productId)!;

        // Fetch active product from DB to obtain authoritative price
        const product = await queryRunner.manager.findOne(Product, {
          where: { id: productId, is_active: true },
        });

        if (!product) {
          throw new NotFoundError(`Active product with ID ${productId} not found`);
        }

        // Acquire pessimistic write lock: SELECT ... FOR UPDATE
        const inventory = await queryRunner.manager
          .createQueryBuilder(Inventory, 'inv')
          .setLock('pessimistic_write')
          .where('inv.branch_id = :branchId AND inv.product_id = :productId', {
            branchId: targetBranchId,
            productId,
          })
          .getOne();

        const currentStock = inventory ? inventory.quantity : 0;
        if (currentStock < quantity) {
          throw new ConflictError(
            `Insufficient stock for product '${product.name}' (SKU: ${product.sku}). Available: ${currentStock}, Requested: ${quantity}`,
            'INSUFFICIENT_STOCK'
          );
        }

        // Deduct inventory atomically
        inventory!.quantity = currentStock - quantity;
        await queryRunner.manager.save(Inventory, inventory!);

        // Compute authoritative line totals in paise
        const unitPricePaise = product.price_paise;
        const subtotalPaise = unitPricePaise * quantity;
        totalAmountPaise += subtotalPaise;

        orderItemsToSave.push({
          product,
          quantity,
          unit_price_paise: unitPricePaise,
          subtotal_paise: subtotalPaise,
        });

        // Record stock movement (ORDER_PLACED)
        const stockMovement = queryRunner.manager.create(StockMovement, {
          branch_id: targetBranchId,
          product_id: productId,
          quantity_change: -quantity,
          balance_after: inventory!.quantity,
          reason: StockMovementReason.ORDER_PLACED,
          reference_id: orderNumber,
          actor_id: currentUser.userId,
        });
        await queryRunner.manager.save(StockMovement, stockMovement);
      }

      // Create Order entity
      const order = queryRunner.manager.create(Order, {
        order_number: orderNumber,
        branch_id: targetBranchId,
        customer_id: customer.id,
        status: OrderStatus.PLACED,
        total_amount_paise: totalAmountPaise,
        created_by_id: currentUser.userId,
      });
      const savedOrder = await queryRunner.manager.save(Order, order);

      // Create OrderItem entities
      const savedItems: OrderItem[] = [];
      for (const itemData of orderItemsToSave) {
        const orderItem = queryRunner.manager.create(OrderItem, {
          order_id: savedOrder.id,
          product_id: itemData.product.id,
          quantity: itemData.quantity,
          unit_price_paise: itemData.unit_price_paise,
          subtotal_paise: itemData.subtotal_paise,
        });
        const savedItem = await queryRunner.manager.save(OrderItem, orderItem);
        savedItem.product = itemData.product;
        savedItems.push(savedItem);
      }

      savedOrder.items = savedItems;
      savedOrder.customer = customer;
      savedOrder.branch = branch;

      // Record Audit Log within same transaction
      await AuditService.recordLog(
        {
          actor_id: currentUser.userId,
          actor_email: currentUser.email,
          action: 'ORDER_PLACED',
          entity_type: 'Order',
          entity_id: savedOrder.id,
          branch_id: targetBranchId,
          metadata: {
            order_number: savedOrder.order_number,
            total_amount_paise: savedOrder.total_amount_paise,
            item_count: savedItems.length,
          },
        },
        queryRunner.manager
      );

      await queryRunner.commitTransaction();
      return savedOrder;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  public static async getOrders(
    filter: { branch_id?: string; status?: OrderStatus },
    currentUser: { role: UserRole; branchId: string | null },
    page = 1,
    limit = 20
  ): Promise<{ orders: Order[]; total: number; page: number; limit: number; totalPages: number }> {
    let effectiveBranchId: string | undefined;

    if (currentUser.role === UserRole.SUPER_ADMIN) {
      effectiveBranchId = filter.branch_id;
    } else {
      if (filter.branch_id && filter.branch_id !== currentUser.branchId) {
        throw new ForbiddenError('Cannot view orders belonging to another branch');
      }
      effectiveBranchId = currentUser.branchId || undefined;
    }

    const qb = AppDataSource.getRepository(Order)
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.customer', 'customer')
      .leftJoinAndSelect('order.branch', 'branch')
      .leftJoinAndSelect('order.items', 'items')
      .leftJoinAndSelect('items.product', 'product')
      .orderBy('order.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (effectiveBranchId) {
      qb.andWhere('order.branch_id = :branchId', { branchId: effectiveBranchId });
    }
    if (filter.status) {
      qb.andWhere('order.status = :status', { status: filter.status });
    }

    const [orders, total] = await qb.getManyAndCount();

    return {
      orders,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  public static async getOrderById(
    id: string,
    currentUser: { role: UserRole; branchId: string | null }
  ): Promise<Order> {
    const order = await AppDataSource.getRepository(Order).findOne({
      where: { id },
      relations: ['items', 'items.product', 'customer', 'branch', 'created_by'],
    });

    if (!order) {
      throw new NotFoundError(`Order with ID ${id} not found`);
    }

    if (currentUser.role !== UserRole.SUPER_ADMIN && currentUser.branchId !== order.branch_id) {
      throw new ForbiddenError('Cannot view order belonging to another branch');
    }

    return order;
  }

  public static async updateOrderStatus(
    orderId: string,
    newStatus: OrderStatus,
    currentUser: { userId: string; email: string; role: UserRole; branchId: string | null }
  ): Promise<Order> {
    const orderRepo = AppDataSource.getRepository(Order);
    const order = await orderRepo.findOne({
      where: { id: orderId },
      relations: ['items', 'items.product', 'customer', 'branch'],
    });

    if (!order) {
      throw new NotFoundError(`Order with ID ${orderId} not found`);
    }

    if (currentUser.role !== UserRole.SUPER_ADMIN && currentUser.branchId !== order.branch_id) {
      throw new ForbiddenError('Cannot update status for an order belonging to another branch');
    }

    // Validate lifecycle transitions: PLACED -> PACKED -> DISPATCHED -> DELIVERED
    const validTransitions: Record<OrderStatus, OrderStatus[]> = {
      [OrderStatus.PLACED]: [OrderStatus.PACKED],
      [OrderStatus.PACKED]: [OrderStatus.DISPATCHED],
      [OrderStatus.DISPATCHED]: [OrderStatus.DELIVERED],
      [OrderStatus.DELIVERED]: [],
      [OrderStatus.CANCELLED]: [],
    };

    const allowedNextStatuses = validTransitions[order.status] || [];
    if (!allowedNextStatuses.includes(newStatus)) {
      throw new ConflictError(
        `Invalid status transition from ${order.status} to ${newStatus}. Valid transitions are: ${
          allowedNextStatuses.length > 0 ? allowedNextStatuses.join(', ') : 'none'
        }`,
        'INVALID_STATUS_TRANSITION'
      );
    }

    order.status = newStatus;
    const updatedOrder = await orderRepo.save(order);

    await AuditService.recordLog({
      actor_id: currentUser.userId,
      actor_email: currentUser.email,
      action: 'ORDER_STATUS_UPDATED',
      entity_type: 'Order',
      entity_id: updatedOrder.id,
      branch_id: updatedOrder.branch_id,
      metadata: { previous_status: order.status, new_status: newStatus },
    });

    return updatedOrder;
  }

  public static async cancelOrder(
    orderId: string,
    reason: string | undefined,
    currentUser: { userId: string; email: string; role: UserRole; branchId: string | null }
  ): Promise<Order> {
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Pessimistic write lock on Order
      const order = await queryRunner.manager
        .createQueryBuilder(Order, 'ord')
        .setLock('pessimistic_write')
        .where('ord.id = :id', { id: orderId })
        .getOne();

      if (!order) {
        throw new NotFoundError(`Order with ID ${orderId} not found`);
      }

      order.items = await queryRunner.manager.find(OrderItem, {
        where: { order_id: order.id },
      });

      if (currentUser.role !== UserRole.SUPER_ADMIN && currentUser.branchId !== order.branch_id) {
        throw new ForbiddenError('Cannot cancel an order belonging to another branch');
      }

      // Check current status
      if (order.status === OrderStatus.CANCELLED) {
        throw new ConflictError('Order is already cancelled', 'ALREADY_CANCELLED');
      }

      if (order.status === OrderStatus.DISPATCHED || order.status === OrderStatus.DELIVERED) {
        throw new ConflictError(
          `Cannot cancel order with status '${order.status}'. Cancellation is only allowed for PLACED or PACKED orders.`,
          'CANNOT_CANCEL_DISPATCHED_ORDER'
        );
      }

      // 2. Sort items deterministically before locking inventory rows
      const sortedItems = [...order.items].sort((a, b) =>
        a.product_id.localeCompare(b.product_id)
      );

      // 3. Restore inventory for each item
      for (const item of sortedItems) {
        const inventory = await queryRunner.manager
          .createQueryBuilder(Inventory, 'inv')
          .setLock('pessimistic_write')
          .where('inv.branch_id = :branchId AND inv.product_id = :productId', {
            branchId: order.branch_id,
            productId: item.product_id,
          })
          .getOne();

        if (inventory) {
          inventory.quantity += item.quantity;
          await queryRunner.manager.save(Inventory, inventory);

          // Record stock movement (ORDER_CANCELLED)
          const stockMovement = queryRunner.manager.create(StockMovement, {
            branch_id: order.branch_id,
            product_id: item.product_id,
            quantity_change: item.quantity,
            balance_after: inventory.quantity,
            reason: StockMovementReason.ORDER_CANCELLED,
            reference_id: order.order_number,
            actor_id: currentUser.userId,
          });
          await queryRunner.manager.save(StockMovement, stockMovement);
        } else {
          // If inventory record didn't exist, create it
          const newInv = queryRunner.manager.create(Inventory, {
            branch_id: order.branch_id,
            product_id: item.product_id,
            quantity: item.quantity,
          });
          await queryRunner.manager.save(Inventory, newInv);

          const stockMovement = queryRunner.manager.create(StockMovement, {
            branch_id: order.branch_id,
            product_id: item.product_id,
            quantity_change: item.quantity,
            balance_after: item.quantity,
            reason: StockMovementReason.ORDER_CANCELLED,
            reference_id: order.order_number,
            actor_id: currentUser.userId,
          });
          await queryRunner.manager.save(StockMovement, stockMovement);
        }
      }

      // 4. Mark order cancelled
      order.status = OrderStatus.CANCELLED;
      order.cancelled_at = new Date();
      order.cancellation_reason = reason || 'Cancelled by user';
      const savedOrder = await queryRunner.manager.save(Order, order);

      // 5. Record Audit Log in same transaction
      await AuditService.recordLog(
        {
          actor_id: currentUser.userId,
          actor_email: currentUser.email,
          action: 'ORDER_CANCELLED',
          entity_type: 'Order',
          entity_id: savedOrder.id,
          branch_id: order.branch_id,
          metadata: {
            order_number: savedOrder.order_number,
            cancellation_reason: savedOrder.cancellation_reason,
            restored_items_count: sortedItems.length,
          },
        },
        queryRunner.manager
      );

      await queryRunner.commitTransaction();
      return savedOrder;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
