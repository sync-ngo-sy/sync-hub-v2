import type { Middleware } from 'openapi-fetch';

export const CSRF_HEADER = 'X-Sync-Request';

const CSRF_VALUE = '1';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS', 'TRACE']);

export const REFRESH_PATH = '/v1/auth/refresh';

export const SESSION_PROBLEM_TYPE = 'urn:sync:problem:not-authenticated';

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

function refreshTarget(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, '')}${REFRESH_PATH}`;
}

const RELATIVE_BASE = 'http://api-client.invalid';

function pathOf(url: string): string {
  return new URL(url, RELATIVE_BASE).pathname;
}

async function isDeadSession(response: Response): Promise<boolean> {
  if (response.status !== 401) return false;
  try {
    const problem: unknown = await response.clone().json();
    return (
      typeof problem === 'object' &&
      problem !== null &&
      (problem as { type?: unknown }).type === SESSION_PROBLEM_TYPE
    );
  } catch {
    return false;
  }
}

export function createAuthFetch({
  baseUrl,
  onSessionExpired,
}: AuthFetchOptions): (request: Request) => Promise<Response> {
  const target = refreshTarget(baseUrl);
  const targetPath = pathOf(target);
  let inFlight: Promise<boolean> | null = null;

  const refreshSession = (): Promise<boolean> => {
    inFlight ??= fetch(target, {
      method: 'POST',
      credentials: 'include',
      headers: { [CSRF_HEADER]: CSRF_VALUE },
    })
      .then((response) => response.ok)
      .catch(() => false)
      .finally(() => {
        inFlight = null;
      });
    return inFlight;
  };

  return async (request) => {
    const replay = request.clone();
    const response = await fetch(request);
    if (!(await isDeadSession(response))) {
      return response;
    }
    if (pathOf(request.url) === targetPath) {
      onSessionExpired?.();
      return response;
    }
    if (!(await refreshSession())) {
      onSessionExpired?.();
      return response;
    }
    const retried = await fetch(replay);
    if (await isDeadSession(retried)) {
      onSessionExpired?.();
    }
    return retried;
  };
}
