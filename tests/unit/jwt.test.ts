import {
  signAccessToken,
  verifyAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  JwtAccessPayload,
  JwtRefreshPayload,
} from '../../src/utils/jwt';
import { UserRole } from '../../src/models/User';

describe('JWT Utilities Unit Tests', () => {
  it('should sign and verify access token with correct payload', () => {
    const payload: JwtAccessPayload = {
      userId: '11111111-1111-1111-1111-111111111111',
      email: 'manager.mum@aarnex.com',
      role: UserRole.BRANCH_MANAGER,
      branchId: '22222222-2222-2222-2222-222222222222',
    };

    const token = signAccessToken(payload);
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3);

    const verified = verifyAccessToken(token);
    expect(verified.userId).toBe(payload.userId);
    expect(verified.email).toBe(payload.email);
    expect(verified.role).toBe(payload.role);
    expect(verified.branchId).toBe(payload.branchId);
  });

  it('should sign and verify refresh token with correct payload', () => {
    const payload: JwtRefreshPayload = {
      userId: '11111111-1111-1111-1111-111111111111',
      tokenId: '33333333-3333-3333-3333-333333333333',
    };

    const token = signRefreshToken(payload);
    expect(typeof token).toBe('string');

    const verified = verifyRefreshToken(token);
    expect(verified.userId).toBe(payload.userId);
    expect(verified.tokenId).toBe(payload.tokenId);
  });

  it('should reject malformed or tampered tokens', () => {
    expect(() => verifyAccessToken('invalid.token.here')).toThrow();
  });
});
