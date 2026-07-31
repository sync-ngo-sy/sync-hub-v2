import type { Middleware } from 'openapi-fetch';

export const CSRF_HEADER = 'X-Sync-Request';

const CSRF_VALUE = '1';

export const REFRESH_PATH = '/v1/auth/refresh';

// Endpoints that re-authenticate a credential the caller just supplied (e.g. a password to confirm
// account deletion), whose 401 is ambiguous: a dead session or a wrong credential. A refresh tells
// the two apart — if it succeeds the session is live, so the 401 is a domain error the caller
// handles rather than a reason to bounce to login (see the 401 branch below).
export const CREDENTIAL_CHALLENGE_PATHS = new Set(['/v1/candidates/me/deletion']);

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
    const { pathname } = new URL(request.url);
    if (pathname === REFRESH_PATH) {
      onSessionExpired?.();
      return response;
    }
    if (!(await refreshSession())) {
      onSessionExpired?.();
      return response;
    }
    // The refresh succeeded, so the session is live. A credential-challenge endpoint's 401 with a
    // live session means the supplied credential was wrong, not that the session died — hand that
    // 401 back for the caller to surface, and don't replay (the same body would only 401 again).
    if (CREDENTIAL_CHALLENGE_PATHS.has(pathname)) {
      return response;
    }
    const retried = await fetch(replay);
    if (retried.status === 401) {
      onSessionExpired?.();
    }
    return retried;
  };
}
