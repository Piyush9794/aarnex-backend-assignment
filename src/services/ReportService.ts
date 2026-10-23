import { AppDataSource } from '../config/database';
import { Order, OrderStatus } from '../models/Order';
import { Branch } from '../models/Branch';
import { UserRole } from '../models/User';
import { ForbiddenError, NotFoundError, ValidationError } from '../utils/errors';

export interface BranchSummaryReport {
  branch_id: string;
  branch_name: string;
  branch_code: string;
  period: {
    from: string;
    to: string;
    timezone: string;
  };
  metrics: {
    total_orders_placed: number;
    net_active_orders: number;
    cancelled_orders: number;
    gross_sales_paise: number;
    cancelled_amount_paise: number;
    net_sales_paise: number;
    net_sales_formatted_inr: string;
  };
  status_breakdown: Record<OrderStatus, { count: number; total_amount_paise: number }>;
}

export class ReportService {
  public static async getBranchSummary(
    branchId: string,
    fromDateStr: string,
    toDateStr: string,
    currentUser: { role: UserRole; branchId: string | null }
  ): Promise<BranchSummaryReport> {
    // 1. Enforce branch authorization
    if (currentUser.role !== UserRole.SUPER_ADMIN && currentUser.branchId !== branchId) {
      throw new ForbiddenError(
        'Access forbidden: Cannot view performance reports for another branch'
      );
    }

    const branch = await AppDataSource.getRepository(Branch).findOne({
      where: { id: branchId },
    });
    if (!branch) {
      throw new NotFoundError(`Branch with ID ${branchId} not found`);
    }

    // 2. Validate date range (Timezone policy: UTC day boundary)
    const fromDate = new Date(`${fromDateStr}T00:00:00.000Z`);
    const toDate = new Date(`${toDateStr}T23:59:59.999Z`);

    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      throw new ValidationError('Invalid date format. Expected YYYY-MM-DD');
    }

    if (fromDate > toDate) {
      throw new ValidationError("'from' date cannot be after 'to' date");
    }

    // 3. Query persisted orders in PostgreSQL
    const orderRepo = AppDataSource.getRepository(Order);
    const orders = await orderRepo
      .createQueryBuilder('order')
      .where('order.branch_id = :branchId', { branchId })
      .andWhere('order.created_at >= :fromDate AND order.created_at <= :toDate', {
        fromDate,
        toDate,
      })
      .getMany();

    // 4. Compute metrics
    const statusBreakdown: Record<OrderStatus, { count: number; total_amount_paise: number }> = {
      [OrderStatus.PLACED]: { count: 0, total_amount_paise: 0 },
      [OrderStatus.PACKED]: { count: 0, total_amount_paise: 0 },
      [OrderStatus.DISPATCHED]: { count: 0, total_amount_paise: 0 },
      [OrderStatus.DELIVERED]: { count: 0, total_amount_paise: 0 },
      [OrderStatus.CANCELLED]: { count: 0, total_amount_paise: 0 },
    };

    let totalOrders = 0;
    let cancelledOrders = 0;
    let netActiveOrders = 0;
    let grossSalesPaise = 0;
    let cancelledAmountPaise = 0;
    let netSalesPaise = 0;

    for (const ord of orders) {
      totalOrders++;
      const amt = Number(ord.total_amount_paise);
      grossSalesPaise += amt;

      if (statusBreakdown[ord.status]) {
        statusBreakdown[ord.status].count++;
        statusBreakdown[ord.status].total_amount_paise += amt;
      }

      if (ord.status === OrderStatus.CANCELLED) {
        cancelledOrders++;
        cancelledAmountPaise += amt;
      } else {
        netActiveOrders++;
        netSalesPaise += amt;
      }
    }

    return {
      branch_id: branch.id,
      branch_name: branch.name,
      branch_code: branch.code,
      period: {
        from: fromDateStr,
        to: toDateStr,
        timezone: 'UTC',
      },
      metrics: {
        total_orders_placed: totalOrders,
        net_active_orders: netActiveOrders,
        cancelled_orders: cancelledOrders,
        gross_sales_paise: grossSalesPaise,
        cancelled_amount_paise: cancelledAmountPaise,
        net_sales_paise: netSalesPaise,
        net_sales_formatted_inr: (netSalesPaise / 100).toFixed(2),
      },
      status_breakdown: statusBreakdown,
    };
  }
}
