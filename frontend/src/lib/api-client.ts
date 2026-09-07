const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';

export function getAccessToken(): string | null {
  return localStorage.getItem('jalaram.accessToken');
}

export function setAccessToken(token: string | null) {
  if (token) localStorage.setItem('jalaram.accessToken', token);
  else localStorage.removeItem('jalaram.accessToken');
}

export function getRefreshToken(): string | null {
  return localStorage.getItem('jalaram.refreshToken');
}

export function setRefreshToken(token: string | null) {
  if (token) localStorage.setItem('jalaram.refreshToken', token);
  else localStorage.removeItem('jalaram.refreshToken');
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
  auth = true,
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  if (auth) {
    const token = getAccessToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers, credentials: 'include' });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? body.error ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

export const useApiAuth = import.meta.env.VITE_USE_API_AUTH !== 'false';
