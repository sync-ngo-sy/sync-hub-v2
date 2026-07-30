import type { Middleware } from 'openapi-fetch';

export const CSRF_HEADER = 'X-Sync-Request';

const CSRF_VALUE = '1';

export const REFRESH_PATH = '/v1/auth/refresh';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS', 'TRACE']);

export const csrfMiddleware: Middleware = {
  onRequest({ request }) {
    if (!SAFE_METHODS.has(request.method.toUpperCase())) {
      request.headers.set(CSRF_HEADER, CSRF_VALUE);
    }
    return request;
  },
};

export interface AuthFetchOptions {
  baseUrl: string;
  onSessionExpired?: () => void;
}

export function createAuthFetch({
  baseUrl,
  onSessionExpired,
}: AuthFetchOptions): (request: Request) => Promise<Response> {
  let refreshInFlight: Promise<boolean> | null = null;

  const refreshSession = (): Promise<boolean> => {
    refreshInFlight ??= fetch(`${baseUrl}${REFRESH_PATH}`, {
      method: 'POST',
      credentials: 'include',
      headers: { [CSRF_HEADER]: CSRF_VALUE },
    })
      .then((response) => response.ok)
      .catch(() => false)
      .finally(() => {
        refreshInFlight = null;
      });
    return refreshInFlight;
  };

  return async (request) => {
    const replay = request.clone();
    const response = await fetch(request);
    if (response.status !== 401) {
      return response;
    }
    if (new URL(request.url).pathname === REFRESH_PATH) {
      onSessionExpired?.();
      return response;
    }
    if (!(await refreshSession())) {
      onSessionExpired?.();
      return response;
    }
    const retried = await fetch(replay);
    if (retried.status === 401) {
      onSessionExpired?.();
    }
    return retried;
  };
}
