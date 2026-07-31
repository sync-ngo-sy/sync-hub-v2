import { QueryClient } from '@tanstack/react-query';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApiClient } from './client';
import { API_ORIGIN, http, PROFILE, SESSION_EXPIRED, WRONG_PASSWORD } from './testing/http';

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function recordRequests(): Request[] {
  const requests: Request[] = [];
  server.events.on('request:start', ({ request }) => requests.push(request));
  return requests;
}

function trace(requests: Request[]): string[] {
  return requests.map((request) => `${request.method} ${new URL(request.url).pathname}`);
}

afterEach(() => server.events.removeAllListeners());

describe('the assembled client', () => {
  it('sends cookie credentials and no CSRF header on a safe request', async () => {
    const requests = recordRequests();
    server.use(http.get('/v1/auth/me', ({ response }) => response(200).json(PROFILE)));

    const { client } = createApiClient({ baseUrl: API_ORIGIN });
    const { data } = await client.GET('/v1/auth/me');

    expect(data).toEqual(PROFILE);
    expect(requests).toHaveLength(1);
    expect(requests[0]?.credentials).toBe('include');
    expect(requests[0]?.headers.has('X-Sync-Request')).toBe(false);
  });

  it('sends the CSRF header on a mutating request', async () => {
    const requests = recordRequests();
    server.use(http.post('/v1/auth/logout', ({ response }) => response(204).empty()));

    const { client } = createApiClient({ baseUrl: API_ORIGIN });
    await client.POST('/v1/auth/logout');

    expect(requests).toHaveLength(1);
    expect(requests[0]?.headers.get('X-Sync-Request')).toBe('1');
    expect(requests[0]?.credentials).toBe('include');
  });
});

describe('an unusable API base', () => {
  it.each(['https://api.sync.test/v1', 'not-a-url'])(
    'is refused at construction rather than at the first request: %j',
    (baseUrl) => {
      expect(() => createApiClient({ baseUrl })).toThrow(/api-client/);
    },
  );
});

describe('an expired access token', () => {
  it('is recovered by exactly one refresh and one retry', async () => {
    const requests = recordRequests();
    let attempts = 0;
    server.use(
      http.get('/v1/auth/me', ({ response }) =>
        ++attempts === 1 ? response(401).json(SESSION_EXPIRED) : response(200).json(PROFILE),
      ),
      http.post('/v1/auth/refresh', ({ response }) => response(200).json(PROFILE)),
    );

    const { client } = createApiClient({ baseUrl: API_ORIGIN });
    const { data } = await client.GET('/v1/auth/me');

    expect(data).toEqual(PROFILE);
    expect(trace(requests)).toEqual([
      'GET /v1/auth/me',
      'POST /v1/auth/refresh',
      'GET /v1/auth/me',
    ]);
    expect(requests[1]?.headers.get('X-Sync-Request')).toBe('1');
    expect(requests[1]?.credentials).toBe('include');
  });

  it('signals session expiry when the refresh itself is rejected', async () => {
    const requests = recordRequests();
    const onSessionExpired = vi.fn();
    server.use(
      http.get('/v1/auth/me', ({ response }) => response(401).json(SESSION_EXPIRED)),
      http.post('/v1/auth/refresh', ({ response }) => response(401).json(SESSION_EXPIRED)),
    );

    const { client } = createApiClient({ baseUrl: API_ORIGIN, onSessionExpired });
    const { response } = await client.GET('/v1/auth/me');

    expect(response.status).toBe(401);
    expect(onSessionExpired).toHaveBeenCalledTimes(1);
    expect(trace(requests)).toEqual(['GET /v1/auth/me', 'POST /v1/auth/refresh']);
  });

  it('signals session expiry when the retry is rejected too, without refreshing twice', async () => {
    const requests = recordRequests();
    const onSessionExpired = vi.fn();
    server.use(
      http.get('/v1/auth/me', ({ response }) => response(401).json(SESSION_EXPIRED)),
      http.post('/v1/auth/refresh', ({ response }) => response(200).json(PROFILE)),
    );

    const { client } = createApiClient({ baseUrl: API_ORIGIN, onSessionExpired });
    const { response } = await client.GET('/v1/auth/me');

    expect(response.status).toBe(401);
    expect(onSessionExpired).toHaveBeenCalledTimes(1);
    expect(trace(requests)).toEqual([
      'GET /v1/auth/me',
      'POST /v1/auth/refresh',
      'GET /v1/auth/me',
    ]);
  });

  it('coalesces concurrent 401s into a single refresh', async () => {
    const requests = recordRequests();
    let refreshed = false;
    server.use(
      http.get('/v1/auth/me', ({ response }) =>
        refreshed ? response(200).json(PROFILE) : response(401).json(SESSION_EXPIRED),
      ),
      http.post('/v1/auth/refresh', ({ response }) => {
        refreshed = true;
        return response(200).json(PROFILE);
      }),
    );

    const { client } = createApiClient({ baseUrl: API_ORIGIN });
    const results = await Promise.all([
      client.GET('/v1/auth/me'),
      client.GET('/v1/auth/me'),
      client.GET('/v1/auth/me'),
    ]);

    expect(results.map(({ data }) => data)).toEqual([PROFILE, PROFILE, PROFILE]);
    expect(trace(requests).filter((entry) => entry === 'POST /v1/auth/refresh')).toHaveLength(1);
  });

  it('replays the retried request with its body and CSRF header intact', async () => {
    const requests = recordRequests();
    const bodies: unknown[] = [];
    let refreshed = false;
    server.use(
      http.post('/v1/tenants/me/tags', async ({ request, response }) => {
        bodies.push(await request.json());
        return refreshed
          ? response(201).json({
              id: '00000000-0000-4000-8000-000000000002',
              name: 'Arabic',
              scope: 'candidate',
              created_at: '2026-07-31T00:00:00Z',
            })
          : response(401).json(SESSION_EXPIRED);
      }),
      http.post('/v1/auth/refresh', ({ response }) => {
        refreshed = true;
        return response(200).json(PROFILE);
      }),
    );

    const { client } = createApiClient({ baseUrl: API_ORIGIN });
    const { data } = await client.POST('/v1/tenants/me/tags', {
      body: { name: 'Arabic', scope: 'candidate' },
    });

    expect(data?.name).toBe('Arabic');
    expect(bodies).toEqual([
      { name: 'Arabic', scope: 'candidate' },
      { name: 'Arabic', scope: 'candidate' },
    ]);
    const tagWrites = requests.filter(
      (request) => new URL(request.url).pathname === '/v1/tenants/me/tags',
    );
    expect(tagWrites.map((request) => request.headers.get('X-Sync-Request'))).toEqual(['1', '1']);
  });

  it('leaves a wrong-password 401 alone, so the app can say so', async () => {
    const requests = recordRequests();
    const onSessionExpired = vi.fn();
    server.use(
      http.post('/v1/candidates/me/deletion', ({ response }) => response(401).json(WRONG_PASSWORD)),
    );

    const { client } = createApiClient({ baseUrl: API_ORIGIN, onSessionExpired });
    const { error } = await client.POST('/v1/candidates/me/deletion', {
      body: { password: 'wrong' },
    });

    expect(error?.type).toBe('urn:sync:problem:invalid-credentials');
    expect(onSessionExpired).not.toHaveBeenCalled();
    expect(trace(requests)).toEqual(['POST /v1/candidates/me/deletion']);
  });

  it('does not refresh in response to the refresh endpoint rejecting', async () => {
    const requests = recordRequests();
    const onSessionExpired = vi.fn();
    server.use(
      http.post('/v1/auth/refresh', ({ response }) => response(401).json(SESSION_EXPIRED)),
    );

    const { client } = createApiClient({ baseUrl: API_ORIGIN, onSessionExpired });
    const { response } = await client.POST('/v1/auth/refresh');

    expect(response.status).toBe(401);
    expect(onSessionExpired).toHaveBeenCalledTimes(1);
    expect(trace(requests)).toEqual(['POST /v1/auth/refresh']);
  });
});

describe('the exported query hooks', () => {
  it('resolve through the same hardened fetch, inheriting the 401 recovery', async () => {
    const requests = recordRequests();
    let refreshed = false;
    server.use(
      http.get('/v1/auth/me', ({ response }) =>
        refreshed ? response(200).json(PROFILE) : response(401).json(SESSION_EXPIRED),
      ),
      http.post('/v1/auth/refresh', ({ response }) => {
        refreshed = true;
        return response(200).json(PROFILE);
      }),
    );

    const { api } = createApiClient({ baseUrl: API_ORIGIN });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const data = await queryClient.fetchQuery(api.queryOptions('get', '/v1/auth/me'));

    expect(data).toEqual(PROFILE);
    expect(trace(requests)).toEqual([
      'GET /v1/auth/me',
      'POST /v1/auth/refresh',
      'GET /v1/auth/me',
    ]);
  });
});
