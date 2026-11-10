import { describe, it, expect } from 'vitest';
import { Otp, IOtp } from '../src/modules/auth/otpModel.js';
import { PatientOtpService } from '../src/modules/auth/patientOtpService.js';

describe('Mongoose Otp Model & PatientOtpService Suite', () => {
  it('validates the Otp Mongoose Schema definition and indexes', () => {
    expect(Otp).toBeDefined();
    expect(Otp.modelName).toBe('Otp');

    const schema = Otp.schema;
    expect(schema.paths.phone).toBeDefined();
    expect(schema.paths.phone.instance).toBe('String');

    expect(schema.paths.purpose).toBeDefined();
    expect(schema.paths.purpose.instance).toBe('String');
    expect((schema.paths.purpose as any).enumValues).toEqual(['REGISTER', 'LOGIN', 'RESET']);
    expect((schema.paths.purpose as any).defaultValue).toBe('REGISTER');

    expect(schema.paths.codeHash).toBeDefined();
    expect(schema.paths.codeHash.instance).toBe('String');

    expect(schema.paths.attempts).toBeDefined();
    expect(schema.paths.attempts.instance).toBe('Number');
    expect((schema.paths.attempts as any).defaultValue).toBe(0);

    expect(schema.paths.expiresAt).toBeDefined();
    expect(schema.paths.expiresAt.instance).toBe('Date');
    expect((schema.paths.expiresAt as any).options.expires).toBe(0);

    // Verify timestamps are enabled
    expect(schema.paths.createdAt).toBeDefined();
    expect(schema.paths.updatedAt).toBeDefined();
  });

  it('generates OTP with default purpose REGISTER', async () => {
    const result = await PatientOtpService.requestOtp('9848011223');
    expect(result.success).toBe(true);
    expect(result.purpose).toBe('REGISTER');
    expect(result.expiresInSeconds).toBe(300);
    expect(result.cooldownSeconds).toBe(60);
    expect(result.demoOtpHint).toBe('123456');
  });

  it('generates OTP with purpose LOGIN and RESET', async () => {
    const loginResult = await PatientOtpService.requestOtp('9848011224', '127.0.0.1', 'LOGIN');
    expect(loginResult.success).toBe(true);
    expect(loginResult.purpose).toBe('LOGIN');

    const resetResult = await PatientOtpService.requestOtp('9848011225', '127.0.0.1', 'RESET');
    expect(resetResult.success).toBe(true);
    expect(resetResult.purpose).toBe('RESET');
  });

  it('verifies valid OTP successfully and deletes challenge', async () => {
    await PatientOtpService.requestOtp('9848011226', '127.0.0.1', 'REGISTER');
    const verifyResult = await PatientOtpService.verifyOtp({
      phone: '9848011226',
      otp: '123456',
      purpose: 'REGISTER',
    });

    expect(verifyResult).toBeDefined();
    expect(verifyResult.user).toBeDefined();
    expect(verifyResult.patient).toBeDefined();
    expect(verifyResult.accessToken).toBeDefined();

    // Second verify should fail as OTP was consumed
    await expect(
      PatientOtpService.verifyOtp({
        phone: '9848011226',
        otp: '123456',
        purpose: 'REGISTER',
      })
    ).rejects.toThrow(/expired or not found/i);
  });

  it('rejects invalid OTP and tracks attempts', async () => {
    await PatientOtpService.requestOtp('9848011227', '127.0.0.1', 'LOGIN');

    await expect(
      PatientOtpService.verifyOtp({
        phone: '9848011227',
        otp: '999999',
        purpose: 'LOGIN',
      })
    ).rejects.toThrow(/invalid otp code.*4 attempt/i);
  });
});

