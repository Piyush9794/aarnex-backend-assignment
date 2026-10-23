import { AppDataSource } from '../config/database';
import { RefreshToken } from '../models/RefreshToken';

export const RefreshTokenRepository = AppDataSource.getRepository(RefreshToken).extend({
  async findValidToken(userId: string, tokenHash: string): Promise<RefreshToken | null> {
    return this.findOne({
      where: {
        user_id: userId,
        token_hash: tokenHash,
        is_revoked: false,
      },
      relations: ['user'],
    });
  },

  async revokeUserTokens(userId: string): Promise<void> {
    await this.update({ user_id: userId, is_revoked: false }, { is_revoked: true });
  },
});
