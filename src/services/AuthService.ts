import { AppDataSource } from '../config/database';
import { User } from '../models/User';
import { RefreshToken } from '../models/RefreshToken';
import { comparePassword, hashToken } from '../utils/password';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../utils/jwt';
import { UnauthorizedError } from '../utils/errors';
import { AuditService } from './AuditService';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface UserSummary {
  id: string;
  email: string;
  full_name: string;
  role: string;
  branch_id: string | null;
  branch?: {
    id: string;
    name: string;
    code: string;
  } | null;
}

export class AuthService {
  public static async login(
    email: string,
    plainPassword: string,
    ipAddress?: string
  ): Promise<{ user: UserSummary; tokens: AuthTokens }> {
    const userRepo = AppDataSource.getRepository(User);

    // Fetch user with password_hash explicitly selected
    const user = await userRepo
      .createQueryBuilder('user')
      .addSelect('user.password_hash')
      .leftJoinAndSelect('user.branch', 'branch')
      .where('LOWER(user.email) = LOWER(:email)', { email })
      .getOne();

    if (!user || !user.is_active) {
      throw new UnauthorizedError('Invalid email or password', 'INVALID_CREDENTIALS');
    }

    const isMatch = await comparePassword(plainPassword, user.password_hash);
    if (!isMatch) {
      throw new UnauthorizedError('Invalid email or password', 'INVALID_CREDENTIALS');
    }

    // Generate tokens
    const tokens = await this.generateTokenPair(user);

    // Audit log
    await AuditService.recordLog({
      actor_id: user.id,
      actor_email: user.email,
      action: 'USER_LOGIN',
      entity_type: 'User',
      entity_id: user.id,
      branch_id: user.branch_id,
      ip_address: ipAddress,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        branch_id: user.branch_id,
        branch: user.branch
          ? {
              id: user.branch.id,
              name: user.branch.name,
              code: user.branch.code,
            }
          : null,
      },
      tokens,
    };
  }

  public static async refreshToken(
    rawRefreshToken: string,
    ipAddress?: string
  ): Promise<AuthTokens> {
    let payload;
    try {
      payload = verifyRefreshToken(rawRefreshToken);
    } catch {
      throw new UnauthorizedError('Invalid or expired refresh token', 'INVALID_REFRESH_TOKEN');
    }

    const tokenRepo = AppDataSource.getRepository(RefreshToken);
    const userRepo = AppDataSource.getRepository(User);

    const storedToken = await tokenRepo.findOne({
      where: { id: payload.tokenId, user_id: payload.userId },
      relations: ['user'],
    });

    if (!storedToken) {
      throw new UnauthorizedError('Refresh token record not found', 'INVALID_REFRESH_TOKEN');
    }

    // Replay attack detection
    if (storedToken.is_revoked) {
      // Invalidate all tokens for this user for security
      await tokenRepo.update({ user_id: payload.userId }, { is_revoked: true });
      await AuditService.recordLog({
        actor_id: payload.userId,
        action: 'REFRESH_TOKEN_REPLAY_ATTEMPT',
        entity_type: 'RefreshToken',
        entity_id: storedToken.id,
        metadata: { warning: 'Revoked refresh token reuse detected. Family revoked.' },
        ip_address: ipAddress,
      });
      throw new UnauthorizedError(
        'Revoked refresh token reuse detected. Please log in again.',
        'TOKEN_REVOKED'
      );
    }

    if (new Date() > storedToken.expires_at) {
      throw new UnauthorizedError('Refresh token has expired', 'REFRESH_TOKEN_EXPIRED');
    }

    const user = await userRepo.findOne({
      where: { id: payload.userId, is_active: true },
      relations: ['branch'],
    });

    if (!user) {
      throw new UnauthorizedError('User account not found or deactivated', 'ACCOUNT_INACTIVE');
    }

    // Atomic rotation within a transaction
    return await AppDataSource.transaction(async (manager) => {
      // Create new refresh token entry
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const newRefreshTokenEntity = manager.create(RefreshToken, {
        user_id: user.id,
        token_hash: 'PENDING',
        expires_at: expiresAt,
        is_revoked: false,
      });
      const savedToken = await manager.save(RefreshToken, newRefreshTokenEntity);

      // Sign the new refresh token with the new tokenId
      const newRefreshTokenJwt = signRefreshToken({
        userId: user.id,
        tokenId: savedToken.id,
      });

      // Update token_hash
      savedToken.token_hash = hashToken(newRefreshTokenJwt);
      await manager.save(RefreshToken, savedToken);

      // Revoke the old token and link to the new token
      storedToken.is_revoked = true;
      storedToken.replaced_by_token_id = savedToken.id;
      await manager.save(RefreshToken, storedToken);

      // Sign new access token
      const newAccessToken = signAccessToken({
        userId: user.id,
        email: user.email,
        role: user.role,
        branchId: user.branch_id,
      });

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshTokenJwt,
      };
    });
  }

  public static async logout(rawRefreshToken?: string, userId?: string): Promise<void> {
    if (rawRefreshToken) {
      try {
        const payload = verifyRefreshToken(rawRefreshToken);
        await AppDataSource.getRepository(RefreshToken).update(
          { id: payload.tokenId },
          { is_revoked: true }
        );
      } catch {
        // If malformed or expired, ignore and proceed
      }
    }

    if (userId) {
      await AuditService.recordLog({
        actor_id: userId,
        action: 'USER_LOGOUT',
        entity_type: 'User',
        entity_id: userId,
      });
    }
  }

  public static async getCurrentUser(userId: string): Promise<UserSummary> {
    const userRepo = AppDataSource.getRepository(User);
    const user = await userRepo.findOne({
      where: { id: userId, is_active: true },
      relations: ['branch'],
    });

    if (!user) {
      throw new UnauthorizedError('User account not found', 'USER_NOT_FOUND');
    }

    return {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      branch_id: user.branch_id,
      branch: user.branch
        ? {
            id: user.branch.id,
            name: user.branch.name,
            code: user.branch.code,
          }
        : null,
    };
  }

  private static async generateTokenPair(user: User): Promise<AuthTokens> {
    const tokenRepo = AppDataSource.getRepository(RefreshToken);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Create record first to obtain UUID
    const tokenRecord = tokenRepo.create({
      user_id: user.id,
      token_hash: 'INITIALIZING',
      expires_at: expiresAt,
      is_revoked: false,
    });
    const saved = await tokenRepo.save(tokenRecord);

    const refreshTokenJwt = signRefreshToken({
      userId: user.id,
      tokenId: saved.id,
    });

    saved.token_hash = hashToken(refreshTokenJwt);
    await tokenRepo.save(saved);

    const accessTokenJwt = signAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      branchId: user.branch_id,
    });

    return {
      accessToken: accessTokenJwt,
      refreshToken: refreshTokenJwt,
    };
  }
}
