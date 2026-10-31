import { describe, it, expect } from 'vitest';
import { Writable } from 'stream';
import { createLogger } from '../src/config/logger.js';

describe('Pino Log Redaction Guard', () => {
  it('strictly redacts credentials, tokens, and patient personal health data', async () => {
    const logChunks: string[] = [];
    const destination = new Writable({
      write(chunk, _encoding, callback) {
        logChunks.push(chunk.toString());
        callback();
      },
    });

    const testLogger = createLogger(destination);

    const sensitiveData = {
      password: 'SuperSecretPassword123!',
      token: 'jwt-access-token-string-xyz',
      refreshToken: 'refresh-token-hash-abc',
      otp: '782910',
      invitationToken: 'invite-secret-999',
      aadhaar: '1234-5678-9012',
      aadhaarNumber: '987654321098',
      phone: '9876543210',
      mobile: '+919876543210',
      patientName: 'Demo Patient Name',
      dob: '1980-01-01',
      dateOfBirth: '1980-01-01',
      address: 'Village Mock, Paderu ITDA',
      abhaId: '14-1234-5678-9012',
      email: 'patient.demo@example.com',
      req: {
        headers: {
          authorization: 'Bearer secret_access_token_123',
          cookie: 'session=super_secret_cookie',
          'x-api-key': 'secret-api-key-header',
        },
      },
    };

    // Log the sensitive data payload
    testLogger.info(sensitiveData, 'Sensitive payload logged for test');

    const combinedOutput = logChunks.join('\n');

    // Assert that sensitive strings NEVER appear in the raw output
    expect(combinedOutput).not.toContain('SuperSecretPassword123!');
    expect(combinedOutput).not.toContain('jwt-access-token-string-xyz');
    expect(combinedOutput).not.toContain('refresh-token-hash-abc');
    expect(combinedOutput).not.toContain('782910');
    expect(combinedOutput).not.toContain('invite-secret-999');
    expect(combinedOutput).not.toContain('1234-5678-9012');
    expect(combinedOutput).not.toContain('987654321098');
    expect(combinedOutput).not.toContain('Demo Patient Name');
    expect(combinedOutput).not.toContain('Village Mock, Paderu ITDA');
    expect(combinedOutput).not.toContain('14-1234-5678-9012');
    expect(combinedOutput).not.toContain('patient.demo@example.com');
    expect(combinedOutput).not.toContain('secret_access_token_123');
    expect(combinedOutput).not.toContain('super_secret_cookie');
    expect(combinedOutput).not.toContain('secret-api-key-header');

    // Parse the logged JSON object and verify redacted values
    const parsed = JSON.parse(logChunks[0]);
    expect(parsed.password).toBe('[REDACTED]');
    expect(parsed.token).toBe('[REDACTED]');
    expect(parsed.otp).toBe('[REDACTED]');
    expect(parsed.aadhaar).toBe('[REDACTED]');
    expect(parsed.patientName).toBe('[REDACTED]');
    expect(parsed.email).toBe('[REDACTED]');
    expect(parsed.req.headers.authorization).toBe('[REDACTED]');
    expect(parsed.req.headers.cookie).toBe('[REDACTED]');
  });
});
