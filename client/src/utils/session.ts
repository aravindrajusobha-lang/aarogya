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

const USER_KEY = 'aarogya_user';
const TOKENS_KEY = 'aarogya_tokens';
const LEGACY_TOKEN_KEY = 'aarogya_token';

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
