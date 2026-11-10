import { authenticator } from 'otplib';

authenticator.options = {
  window: 1, // +/- 30s clock drift allowance
};

export interface MfaSetupDetails {
  secret: string;
  otpauthUrl: string;
}

export function generateMfaSecret(): string {
  return authenticator.generateSecret();
}

export function generateKeyUri(username: string, secret: string): string {
  return authenticator.keyuri(username, 'Aarogya-Drishti (ITDA Paderu)', secret);
}

export function verifyTotp(secret: string, token: string): boolean {
  if (!token || !secret) return false;
  return authenticator.check(token.trim(), secret);
}
