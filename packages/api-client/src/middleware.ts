import type { Middleware } from 'openapi-fetch';

/** The backend gates every unsafe method on the presence of this header (ADR-0005). */
export const CSRF_HEADER = 'X-Sync-Request';

/** The backend only checks that the header is present, so any non-empty value serves. */
const CSRF_VALUE = '1';

/** Session-refresh endpoint — the only path the backend lets mint fresh auth cookies. */
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

/**
 * A `fetch` that transparently recovers one expired access token: on a 401 it refreshes
 * the session once — coalescing concurrent refreshes into a single call — and replays the
 * original request. A failed refresh, or a second 401 after a successful one, signals
 * `onSessionExpired` and returns the 401 untouched.
 */
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
