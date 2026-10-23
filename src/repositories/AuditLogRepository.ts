import { AppDataSource } from '../config/database';
import { AuditLog } from '../models/AuditLog';

export const AuditLogRepository = AppDataSource.getRepository(AuditLog).extend({
  async findLogs(
    filter: { entity_type?: string; entity_id?: string; action?: string; branch_id?: string },
    page = 1,
    limit = 50
  ): Promise<[AuditLog[], number]> {
    const qb = this.createQueryBuilder('log')
      .leftJoinAndSelect('log.actor', 'actor')
      .orderBy('log.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (filter.entity_type) {
      qb.andWhere('log.entity_type = :entityType', { entityType: filter.entity_type });
    }
    if (filter.entity_id) {
      qb.andWhere('log.entity_id = :entityId', { entityId: filter.entity_id });
    }
    if (filter.action) {
      qb.andWhere('log.action = :action', { action: filter.action });
    }
    if (filter.branch_id) {
      qb.andWhere('log.branch_id = :branchId', { branchId: filter.branch_id });
    }

    return qb.getManyAndCount();
  },
});
