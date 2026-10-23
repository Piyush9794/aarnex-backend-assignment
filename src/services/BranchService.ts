import { AppDataSource } from '../config/database';
import { Branch } from '../models/Branch';
import { ConflictError, NotFoundError } from '../utils/errors';
import { AuditService } from './AuditService';

export interface CreateBranchDTO {
  name: string;
  code: string;
  address: string;
  phone: string;
}

export class BranchService {
  public static async getAllBranches(): Promise<Branch[]> {
    const branchRepo = AppDataSource.getRepository(Branch);
    return branchRepo.find({
      order: { name: 'ASC' },
    });
  }

  public static async getBranchById(id: string): Promise<Branch> {
    const branchRepo = AppDataSource.getRepository(Branch);
    const branch = await branchRepo.findOne({ where: { id } });
    if (!branch) {
      throw new NotFoundError(`Branch with ID ${id} not found`);
    }
    return branch;
  }

  public static async createBranch(
    dto: CreateBranchDTO,
    actorId?: string,
    actorEmail?: string
  ): Promise<Branch> {
    const branchRepo = AppDataSource.getRepository(Branch);

    // Check unique name and code
    const existingCode = await branchRepo.findOne({ where: { code: dto.code } });
    if (existingCode) {
      throw new ConflictError(`Branch with code '${dto.code}' already exists`);
    }

    const existingName = await branchRepo.findOne({ where: { name: dto.name } });
    if (existingName) {
      throw new ConflictError(`Branch with name '${dto.name}' already exists`);
    }

    const branch = branchRepo.create(dto);
    const saved = await branchRepo.save(branch);

    await AuditService.recordLog({
      actor_id: actorId,
      actor_email: actorEmail,
      action: 'BRANCH_CREATED',
      entity_type: 'Branch',
      entity_id: saved.id,
      branch_id: saved.id,
      metadata: { name: saved.name, code: saved.code },
    });

    return saved;
  }
}
