import { EntityManager } from 'typeorm';
import { AppDataSource } from '../config/database';
import { AuditLog } from '../models/AuditLog';
import { logger } from '../config/logger';

export interface CreateAuditLogParams {
  actor_id?: string | null;
  actor_email?: string | null;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  branch_id?: string | null;
  metadata?: Record<string, unknown> | null;
  ip_address?: string | null;
}

export class AuditService {
  /**
   * Records an audit log. Accepts optional EntityManager to participate in an active transaction.
   */
  public static async recordLog(
    params: CreateAuditLogParams,
    manager?: EntityManager
  ): Promise<AuditLog> {
    try {
      // Sanitize metadata to never include sensitive credentials
      const safeMetadata = params.metadata ? this.sanitizeMetadata(params.metadata) : null;

      const logData = {
        actor_id: params.actor_id || null,
        actor_email: params.actor_email || null,
        action: params.action,
        entity_type: params.entity_type,
        entity_id: params.entity_id || null,
        branch_id: params.branch_id || null,
        metadata: safeMetadata,
        ip_address: params.ip_address || null,
      };

      if (manager) {
        const log = manager.create(AuditLog, logData);
        return await manager.save(AuditLog, log);
      }

      const repo = AppDataSource.getRepository(AuditLog);
      const log = repo.create(logData);
      return await repo.save(log);
    } catch (error) {
      logger.error({ error, params }, 'Failed to record audit log');
      throw error;
    }
  }

  public static async getLogs(
    filter: { entity_type?: string; entity_id?: string; action?: string; branch_id?: string },
    page = 1,
    limit = 50
  ): Promise<[AuditLog[], number]> {
    const qb = AppDataSource.getRepository(AuditLog)
      .createQueryBuilder('log')
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
  }

  private static sanitizeMetadata(data: Record<string, unknown>): Record<string, unknown> {
    const sensitiveKeys = ['password', 'password_hash', 'token', 'refreshToken', 'secret'];
    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(data)) {
      if (sensitiveKeys.some((k) => key.toLowerCase().includes(k))) {
        sanitized[key] = '[REDACTED]';
      } else if (value && typeof value === 'object' && !Array.isArray(value)) {
        sanitized[key] = this.sanitizeMetadata(value as Record<string, unknown>);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }
}
