import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sendOtpSms } from '../src/modules/auth/smsService.js';

describe('MSG91 sendOtpSms Service Suite', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it('logs OTP in development mode without external API call when MSG91_AUTH_KEY is unset', async () => {
    process.env.NODE_ENV = 'development';
    delete process.env.MSG91_AUTH_KEY;

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    await expect(sendOtpSms('9848012345', '654321')).resolves.toBeUndefined();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('[DEV] OTP for 9848012345: 654321'));
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('dispatches to MSG91 Flow API when MSG91_AUTH_KEY and template are configured', async () => {
    process.env.MSG91_AUTH_KEY = 'test_msg91_key_123';
    process.env.MSG91_TEMPLATE_ID = 'test_template_456';

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ type: 'success' }),
      text: async () => '{"type":"success"}',
    } as any);

    await sendOtpSms('+919848012345', '849201');

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://control.msg91.com/api/v5/flow/',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          authkey: 'test_msg91_key_123',
          'Content-Type': 'application/json',
        }),
      })
    );

    const callArgs = fetchSpy.mock.calls[0];
    const body = JSON.parse(callArgs[1]?.body as string);
    expect(body.template_id).toBe('test_template_456');
    expect(body.recipients[0].mobiles).toBe('919848012345');
    expect(body.recipients[0].OTP).toBe('849201');
  });

  it('throws "SMS provider failed" when MSG91 returns non-OK response', async () => {
    process.env.MSG91_AUTH_KEY = 'test_msg91_key_123';
    process.env.MSG91_TEMPLATE_ID = 'test_template_456';

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => 'Invalid Auth Key',
    } as any);

    await expect(sendOtpSms('9848012345', '112233')).rejects.toThrow('SMS provider failed');
  });
});

