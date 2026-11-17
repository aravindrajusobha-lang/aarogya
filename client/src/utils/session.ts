export interface StoredAuthUser {
  userId: string;
  username?: string;
  fullName?: string;
  role?: string;
  capabilities?: string[];
  [key: string]: unknown;
}

export interface StoredAuthTokens {
  accessToken: string;
  refreshToken?: string;
  deviceSessionId?: string;
}

export interface RefreshedAuthTokens extends StoredAuthTokens {
  refreshToken: string;
  deviceSessionId: string;
}

const USER_KEY = 'aarogya_user';
const TOKENS_KEY = 'aarogya_tokens';
const LEGACY_TOKEN_KEY = 'aarogya_token';
let refreshInFlight: Promise<RefreshedAuthTokens | null> | null = null;

export function readStoredAuth(): { user: StoredAuthUser | null; tokens: StoredAuthTokens | null } {
  try {
    const userRaw = localStorage.getItem(USER_KEY);
    const tokensRaw = localStorage.getItem(TOKENS_KEY);
    const user = userRaw ? (JSON.parse(userRaw) as StoredAuthUser) : null;
    let tokens = tokensRaw ? (JSON.parse(tokensRaw) as StoredAuthTokens) : null;
    if (!tokens) {
      const legacy = localStorage.getItem(LEGACY_TOKEN_KEY);
      if (legacy) tokens = { accessToken: legacy };
    }
    if (!tokens?.accessToken) tokens = null;
    if (!user || !tokens) return { user: null, tokens: null };
    return { user, tokens };
  } catch {
    return { user: null, tokens: null };
  }
}

export function storeAuth(user: StoredAuthUser, tokens: StoredAuthTokens): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  localStorage.setItem(TOKENS_KEY, JSON.stringify(tokens));
  localStorage.setItem(LEGACY_TOKEN_KEY, tokens.accessToken);
}

export function clearStoredAuth(): void {
  const keys = [
    USER_KEY,
    TOKENS_KEY,
    LEGACY_TOKEN_KEY,
    'aarogya_patient_name',
    'aarogya_patient_phone',
    'aarogya_patient_address',
    'aarogya_patient_abha',
  ];
  keys.forEach((k) => {
    try { localStorage.removeItem(k); } catch { /* ignore */ }
  });
  try { sessionStorage.removeItem('aarogya_post_login_route'); } catch { /* ignore */ }
}

export async function validateAccessToken(accessToken: string): Promise<StoredAuthUser | null> {
  try {
    const res = await fetch('/api/v1/auth/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const payload = await res.json().catch(() => null);
    if (!res.ok || !payload?.success || !payload?.data) return null;
    return payload.data as StoredAuthUser;
  } catch {
    return null;
  }
}

export async function refreshStoredAuth(): Promise<RefreshedAuthTokens | null> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const { tokens } = readStoredAuth();
      if (!tokens?.refreshToken || /^(demo_|mock_|offline_)/i.test(tokens.accessToken)) return null;

      const response = await fetch('/api/v1/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: tokens.refreshToken }),
      });
      const payload = await response.json();
      if (response.status === 401 || response.status === 403) return null;
      if (!response.ok || !payload?.success || !payload.data?.accessToken || !payload.data?.refreshToken || !payload.data?.deviceSessionId) {
        throw new Error(payload?.error?.message || 'Your session could not be refreshed.');
      }

      const refreshedTokens: RefreshedAuthTokens = {
        ...tokens,
        accessToken: payload.data.accessToken,
        refreshToken: payload.data.refreshToken,
        deviceSessionId: payload.data.deviceSessionId,
      };
      localStorage.setItem(TOKENS_KEY, JSON.stringify(refreshedTokens));
      localStorage.setItem(LEGACY_TOKEN_KEY, refreshedTokens.accessToken);
      window.dispatchEvent(new CustomEvent('aarogya:auth-refreshed', { detail: refreshedTokens }));
      return refreshedTokens;
    })().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

export async function validateStoredSession(tokens: StoredAuthTokens): Promise<{
  user: StoredAuthUser;
  tokens: StoredAuthTokens;
} | null> {
  const user = await validateAccessToken(tokens.accessToken);
  if (user) return { user, tokens };

  const refreshedTokens = await refreshStoredAuth();
  if (!refreshedTokens) return null;
  const refreshedUser = await validateAccessToken(refreshedTokens.accessToken);
  return refreshedUser ? { user: refreshedUser, tokens: refreshedTokens } : null;
}
