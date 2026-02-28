/**
 * Thin localStorage wrapper for auth token management.
 * The frontend never talks to Supabase directly — tokens are issued by the
 * backend and stored here.
 */

const ACCESS_KEY = 'auth_access_token';
const REFRESH_KEY = 'auth_refresh_token';
const EXPIRES_AT_KEY = 'auth_expires_at';

export function getToken(): string | null {
  return localStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_KEY);
}

export function getExpiresAt(): number | null {
  const raw = localStorage.getItem(EXPIRES_AT_KEY);
  return raw ? Number(raw) : null;
}

export function setTokens(
  accessToken: string,
  refreshToken?: string | null,
  expiresAt?: number | null,
): void {
  localStorage.setItem(ACCESS_KEY, accessToken);
  if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
  if (expiresAt != null) localStorage.setItem(EXPIRES_AT_KEY, String(expiresAt));
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(EXPIRES_AT_KEY);
}
