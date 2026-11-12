import { afterEach, describe, expect, it, vi } from 'vitest';
import { DailyAdapter } from '../src/modules/consultation/dailyAdapter.js';

describe('DailyAdapter', () => {
  const env = { key: process.env.DAILY_API_KEY, domain: process.env.DAILY_DOMAIN, fetch: global.fetch };
  afterEach(() => { process.env.DAILY_API_KEY = env.key; process.env.DAILY_DOMAIN = env.domain; global.fetch = env.fetch; vi.restoreAllMocks(); });

  it('blocks room creation until the server-only credentials exist', async () => {
    delete process.env.DAILY_API_KEY; delete process.env.DAILY_DOMAIN;
    await expect(DailyAdapter.createRoom(Math.floor(Date.now()/1000)+3600)).rejects.toMatchObject({ code: 'VIDEO_PROVIDER_BLOCKED', statusCode: 503 });
  });

  it('creates private two-person rooms and participant-scoped meeting tokens', async () => {
    process.env.DAILY_API_KEY = 'server-test-key'; process.env.DAILY_DOMAIN = 'example.daily.co';
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ name: 'private-room', url: 'https://example.daily.co/private-room' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ token: 'provider-participant-token' }) });
    global.fetch = fetchMock as any;
    const expires = Math.floor(Date.now()/1000)+3600;
    const room = await DailyAdapter.createRoom(expires);
    expect(room.url).toBe('https://example.daily.co/private-room');
    const roomBody = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(roomBody.privacy).toBe('private'); expect(roomBody.properties.max_participants).toBe(2); expect(roomBody.properties.exp).toBe(expires);
    const token = await DailyAdapter.createMeetingToken(room.name, 'patient-user', 'Synthetic Patient', expires, false);
    expect(token).toBe('provider-participant-token');
    const tokenBody = JSON.parse(fetchMock.mock.calls[1][1].body as string);
    expect(tokenBody.properties.room_name).toBe('private-room'); expect(tokenBody.properties.user_id).toBe('patient-user'); expect(tokenBody.properties.is_owner).toBe(false);
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer server-test-key');
  });
});
