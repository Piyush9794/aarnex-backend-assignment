import { AuditService } from '../../src/services/AuditService';

describe('Audit Log Metadata Sanitizer Unit Tests', () => {
  it('should redact sensitive password and token fields from audit metadata', () => {
    const rawMetadata = {
      user_id: '123',
      action: 'LOGIN',
      password: 'SecretPassword123!',
      password_hash: '$2b$10$abcdefgh...',
      nested: {
        refreshToken: 'jwt.refresh.token.xyz',
        database_url: 'postgres://user:secret@host/db',
        safeNote: 'Order verified',
      },
    };

    // Access the private method via reflection or cast
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sanitized = (AuditService as any).sanitizeMetadata(rawMetadata);

    expect(sanitized.user_id).toBe('123');
    expect(sanitized.action).toBe('LOGIN');
    expect(sanitized.password).toBe('[REDACTED]');
    expect(sanitized.password_hash).toBe('[REDACTED]');
    expect(sanitized.nested.refreshToken).toBe('[REDACTED]');
    expect(sanitized.nested.safeNote).toBe('Order verified');
  });
});
