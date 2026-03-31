import type { ApiResponse } from '../types';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';
const TIMEOUT_MS = 8000;

async function getAuthToken(): Promise<string | null> {
  try {
    const { fetchAuthSession } = await import('aws-amplify/auth');
    const session = await fetchAuthSession();
    return session.tokens?.idToken?.toString() ?? null;
  } catch (err) {
    console.warn('Auth token fetch failed:', (err as Error)?.message || 'unknown');
    return null;
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  options?: { public?: boolean; timeoutMs?: number }
): Promise<ApiResponse<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options?.timeoutMs ?? TIMEOUT_MS);

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (!options?.public) {
      const token = await getAuthToken();
      if (token) headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!res.ok) {
      // On 401, try refreshing the token once before giving up
      if (res.status === 401 && !options?.public) {
        try {
          const { fetchAuthSession } = await import('aws-amplify/auth');
          await fetchAuthSession({ forceRefresh: true });
        } catch {
          // Token refresh failed — session is truly expired, redirect to sign-in
          console.warn('Session expired — redirecting to sign-in');
          try {
            const { signOut } = await import('aws-amplify/auth');
            await signOut();
          } catch { /* best-effort */ }
          if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/auth')) {
            window.location.replace('/auth/sign-in?expired=true');
          }
        }
      }
      const err = await res.json().catch(() => ({ error: res.statusText }));
      return {
        data: null,
        error: err.error || `HTTP ${res.status}`,
        status: 'error',
        statusCode: res.status,
      };
    }

    const data = await res.json();
    return { data, error: null, status: 'success', statusCode: res.status };
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof DOMException && err.name === 'AbortError') {
      return { data: null, error: 'Request timed out', status: 'timeout' };
    }
    if (!navigator.onLine) {
      return { data: null, error: 'You are offline', status: 'offline' };
    }
    return {
      data: null,
      error: err instanceof Error ? err.message : 'Unknown error',
      status: 'error',
    };
  }
}

export const api = {
  get: <T>(path: string, opts?: { public?: boolean }) =>
    request<T>('GET', path, undefined, opts),
  post: <T>(path: string, body?: unknown, opts?: { public?: boolean; timeoutMs?: number }) =>
    request<T>('POST', path, body, opts),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
};
