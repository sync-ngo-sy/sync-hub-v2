import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApiClient } from './client';
import { CSRF_HEADER } from './middleware';
import { API_ORIGIN, http, PROBLEM, PROFILE } from './testing/http';

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const makeClient = (onSessionExpired?: () => void) =>
  createApiClient({ baseUrl: API_ORIGIN, onSessionExpired });

describe('credentials', () => {
  it('sends cookie credentials on every request', async () => {
    // Read the credentials mode off the outgoing Request directly — undici normalizes
    // it away at the MSW boundary, so a network-seam handler cannot observe it.
    const seen: RequestCredentials[] = [];
    const original = globalThis.fetch;
    globalThis.fetch = (async (input: Request) => {
      seen.push(input.credentials);
      return Response.json(PROFILE);
    }) as typeof globalThis.fetch;
    try {
      await makeClient().client.GET('/v1/auth/me');
    } finally {
      globalThis.fetch = original;
    }
    expect(seen).toEqual(['include']);
  });
});

describe('CSRF header', () => {
  it('is omitted on safe GET requests', async () => {
    let header: string | null = 'unset';
    server.use(
      http.get('/v1/auth/me', ({ request, response }) => {
        header = request.headers.get(CSRF_HEADER);
        return response(200).json(PROFILE);
      }),
    );
    await makeClient().client.GET('/v1/auth/me');
    expect(header).toBeNull();
  });

  it('is sent on mutating POST requests', async () => {
    let header: string | null = null;
    server.use(
      http.post('/v1/auth/logout', ({ request, response }) => {
        header = request.headers.get(CSRF_HEADER);
        return response(204).empty();
      }),
    );
    await makeClient().client.POST('/v1/auth/logout');
    expect(header).not.toBeNull();
  });
});

describe('401 → refresh → retry', () => {
  it('refreshes once and replays the original request', async () => {
    let meCalls = 0;
    let refreshCalls = 0;
    server.use(
      http.get('/v1/auth/me', ({ response }) => {
        meCalls += 1;
        return meCalls === 1 ? response(401).json(PROBLEM) : response(200).json(PROFILE);
      }),
      http.post('/v1/auth/refresh', ({ response }) => {
        refreshCalls += 1;
        return response(200).json(PROFILE);
      }),
    );
    const onSessionExpired = vi.fn();
    const { data, error } = await makeClient(onSessionExpired).client.GET('/v1/auth/me');
    expect(refreshCalls).toBe(1);
    expect(meCalls).toBe(2);
    expect(error).toBeUndefined();
    expect(data).toEqual(PROFILE);
    expect(onSessionExpired).not.toHaveBeenCalled();
  });

  it('replays the request body when retrying a mutation', async () => {
    const bodies: string[] = [];
    let loginCalls = 0;
    server.use(
      http.post('/v1/auth/login', async ({ request, response }) => {
        bodies.push(await request.text());
        loginCalls += 1;
        return loginCalls === 1
          ? response.untyped(new Response(null, { status: 401 }))
          : response(200).json(PROFILE);
      }),
      http.post('/v1/auth/refresh', ({ response }) => response(200).json(PROFILE)),
    );
    const { error } = await makeClient().client.POST('/v1/auth/login', {
      body: { email: 'a@b.co', password: 'pw' },
    });
    expect(error).toBeUndefined();
    expect(bodies).toHaveLength(2);
    expect(bodies[0]).toContain('a@b.co');
    expect(bodies[1]).toBe(bodies[0]);
  });

  it('signals session-expired when the refresh fails', async () => {
    let refreshCalls = 0;
    server.use(
      http.get('/v1/auth/me', ({ response }) => response(401).json(PROBLEM)),
      http.post('/v1/auth/refresh', ({ response }) => {
        refreshCalls += 1;
        return response(401).json(PROBLEM);
      }),
    );
    const onSessionExpired = vi.fn();
    await makeClient(onSessionExpired).client.GET('/v1/auth/me');
    expect(refreshCalls).toBe(1);
    expect(onSessionExpired).toHaveBeenCalledTimes(1);
  });

  it('signals session-expired when the retry still returns 401', async () => {
    let meCalls = 0;
    server.use(
      http.get('/v1/auth/me', ({ response }) => {
        meCalls += 1;
        return response(401).json(PROBLEM);
      }),
      http.post('/v1/auth/refresh', ({ response }) => response(200).json(PROFILE)),
    );
    const onSessionExpired = vi.fn();
    await makeClient(onSessionExpired).client.GET('/v1/auth/me');
    expect(meCalls).toBe(2);
    expect(onSessionExpired).toHaveBeenCalledTimes(1);
  });

  it('does not recurse when the refresh endpoint itself returns 401', async () => {
    let refreshCalls = 0;
    server.use(
      http.post('/v1/auth/refresh', ({ response }) => {
        refreshCalls += 1;
        return response(401).json(PROBLEM);
      }),
    );
    const onSessionExpired = vi.fn();
    await makeClient(onSessionExpired).client.POST('/v1/auth/refresh');
    expect(refreshCalls).toBe(1);
    expect(onSessionExpired).toHaveBeenCalledTimes(1);
  });

  it('coalesces concurrent 401s into a single refresh', async () => {
    let meCalls = 0;
    let refreshCalls = 0;
    server.use(
      http.get('/v1/auth/me', ({ response }) => {
        meCalls += 1;
        return meCalls <= 3 ? response(401).json(PROBLEM) : response(200).json(PROFILE);
      }),
      http.post('/v1/auth/refresh', ({ response }) => {
        refreshCalls += 1;
        return response(200).json(PROFILE);
      }),
    );
    const { client } = makeClient();
    const results = await Promise.all([
      client.GET('/v1/auth/me'),
      client.GET('/v1/auth/me'),
      client.GET('/v1/auth/me'),
    ]);
    expect(refreshCalls).toBe(1);
    expect(results.every((result) => result.error === undefined)).toBe(true);
  });
});
