import { hashPassword, comparePassword, hashToken } from '../../src/utils/password';

describe('Password and Token Utilities Unit Tests', () => {
  it('should hash a plain password and verify correctly', async () => {
    const password = 'SuperSecurePassword@123';
    const hash = await hashPassword(password);

    expect(hash).not.toBe(password);
    expect(hash.startsWith('$2b$') || hash.startsWith('$2a$')).toBe(true);

    const isMatch = await comparePassword(password, hash);
    expect(isMatch).toBe(true);

    const isWrong = await comparePassword('WrongPassword', hash);
    expect(isWrong).toBe(false);
  });

  it('should generate deterministic sha256 hex string for tokens', () => {
    const token = 'sample-random-refresh-token-xyz';
    const hash1 = hashToken(token);
    const hash2 = hashToken(token);

    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64); // SHA-256 is 64 hex characters
  });
});
