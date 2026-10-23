import { AppDataSource } from '../config/database';
import { Customer } from '../models/Customer';
import { Branch } from '../models/Branch';
import { ConflictError, NotFoundError, ForbiddenError } from '../utils/errors';
import { UserRole } from '../models/User';
import { AuditService } from './AuditService';

export interface CreateCustomerDTO {
  name: string;
  email: string;
  phone: string;
  branch_id?: string;
}

export class CustomerService {
  public static async getCustomers(
    currentUser: { role: UserRole; branchId: string | null },
    queryBranchId?: string,
    page = 1,
    limit = 20
  ): Promise<{ customers: Customer[]; total: number; page: number; limit: number; totalPages: number }> {
    const customerRepo = AppDataSource.getRepository(Customer);

    let effectiveBranchId: string | undefined;

    if (currentUser.role === UserRole.SUPER_ADMIN) {
      effectiveBranchId = queryBranchId;
    } else {
      // Non-superadmin is strictly locked to their assigned branch
      if (queryBranchId && queryBranchId !== currentUser.branchId) {
        throw new ForbiddenError('Cannot access customers belonging to another branch');
      }
      effectiveBranchId = currentUser.branchId || undefined;
    }

    const qb = customerRepo
      .createQueryBuilder('customer')
      .leftJoinAndSelect('customer.branch', 'branch')
      .orderBy('customer.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (effectiveBranchId) {
      qb.where('customer.branch_id = :branchId', { branchId: effectiveBranchId });
    }

    const [customers, total] = await qb.getManyAndCount();

    return {
      customers,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  public static async createCustomer(
    dto: CreateCustomerDTO,
    currentUser: { userId: string; email: string; role: UserRole; branchId: string | null }
  ): Promise<Customer> {
    const customerRepo = AppDataSource.getRepository(Customer);
    const branchRepo = AppDataSource.getRepository(Branch);

    let targetBranchId: string;

    if (currentUser.role === UserRole.SUPER_ADMIN) {
      if (!dto.branch_id) {
        throw new NotFoundError('branch_id is required when creating customer as SUPER_ADMIN');
      }
      targetBranchId = dto.branch_id;
    } else {
      if (!currentUser.branchId) {
        throw new ForbiddenError('Staff or manager must be assigned to a branch');
      }
      targetBranchId = currentUser.branchId;
    }

    const branch = await branchRepo.findOne({ where: { id: targetBranchId } });
    if (!branch) {
      throw new NotFoundError(`Branch with ID ${targetBranchId} not found`);
    }

    // Check duplicate customer in this branch
    const existing = await customerRepo.findOne({
      where: { branch_id: targetBranchId, email: dto.email.toLowerCase() },
    });
    if (existing) {
      throw new ConflictError(
        `Customer with email '${dto.email}' already exists in branch '${branch.name}'`
      );
    }

    const customer = customerRepo.create({
      name: dto.name,
      email: dto.email.toLowerCase(),
      phone: dto.phone,
      branch_id: targetBranchId,
    });

    const saved = await customerRepo.save(customer);

    await AuditService.recordLog({
      actor_id: currentUser.userId,
      actor_email: currentUser.email,
      action: 'CUSTOMER_CREATED',
      entity_type: 'Customer',
      entity_id: saved.id,
      branch_id: targetBranchId,
      metadata: { name: saved.name, email: saved.email },
    });

    return saved;
  }
}
