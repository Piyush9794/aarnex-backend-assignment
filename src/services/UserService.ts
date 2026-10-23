import { AppDataSource } from '../config/database';
import { User, UserRole } from '../models/User';
import { Branch } from '../models/Branch';
import { RefreshToken } from '../models/RefreshToken';
import { ConflictError, NotFoundError, ValidationError } from '../utils/errors';
import { hashPassword } from '../utils/password';
import { AuditService } from './AuditService';

export interface CreateUserDTO {
  email: string;
  password: string;
  full_name: string;
  role: UserRole;
  branch_id?: string | null;
}

export class UserService {
  public static async createUser(
    dto: CreateUserDTO,
    actorId?: string,
    actorEmail?: string
  ): Promise<Omit<User, 'password_hash'>> {
    const userRepo = AppDataSource.getRepository(User);
    const branchRepo = AppDataSource.getRepository(Branch);

    // Validate email uniqueness
    const existing = await userRepo.findOne({
      where: { email: dto.email.toLowerCase() },
    });
    if (existing) {
      throw new ConflictError(`User with email '${dto.email}' already exists`);
    }

    // Role and branch assignment validation
    if (dto.role === UserRole.BRANCH_MANAGER || dto.role === UserRole.STAFF) {
      if (!dto.branch_id) {
        throw new ValidationError(`Branch ID is required for role ${dto.role}`);
      }
      const branch = await branchRepo.findOne({ where: { id: dto.branch_id } });
      if (!branch) {
        throw new NotFoundError(`Branch with ID ${dto.branch_id} does not exist`);
      }
    } else if (dto.role === UserRole.SUPER_ADMIN) {
      // SUPER_ADMIN has global scope, branch_id typically null
      dto.branch_id = dto.branch_id || null;
    }

    const hashedPassword = await hashPassword(dto.password);

    const user = userRepo.create({
      email: dto.email.toLowerCase(),
      password_hash: hashedPassword,
      full_name: dto.full_name,
      role: dto.role,
      branch_id: dto.branch_id || null,
      is_active: true,
    });

    const saved = await userRepo.save(user);

    await AuditService.recordLog({
      actor_id: actorId,
      actor_email: actorEmail,
      action: 'USER_CREATED',
      entity_type: 'User',
      entity_id: saved.id,
      branch_id: saved.branch_id,
      metadata: { email: saved.email, role: saved.role, full_name: saved.full_name },
    });

    // Exclude password_hash from return
    const { password_hash, ...userResponse } = saved;
    return userResponse as Omit<User, 'password_hash'>;
  }

  public static async updateUserStatus(
    userId: string,
    isActive: boolean,
    actorId?: string,
    actorEmail?: string
  ): Promise<Omit<User, 'password_hash'>> {
    const userRepo = AppDataSource.getRepository(User);
    const user = await userRepo.findOne({
      where: { id: userId },
      relations: ['branch'],
    });

    if (!user) {
      throw new NotFoundError(`User with ID ${userId} not found`);
    }

    user.is_active = isActive;
    const updated = await userRepo.save(user);

    // If deactivated, revoke all active refresh tokens immediately
    if (!isActive) {
      await AppDataSource.getRepository(RefreshToken).update(
        { user_id: userId, is_revoked: false },
        { is_revoked: true }
      );
    }

    await AuditService.recordLog({
      actor_id: actorId,
      actor_email: actorEmail,
      action: isActive ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
      entity_type: 'User',
      entity_id: user.id,
      branch_id: user.branch_id,
      metadata: { email: user.email, is_active: isActive },
    });

    const { password_hash, ...userResponse } = updated;
    return userResponse as Omit<User, 'password_hash'>;
  }
}
