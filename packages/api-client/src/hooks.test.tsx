// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { setupServer } from 'msw/node';
import type { ReactNode } from 'react';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createApiClient } from './client';
import { API_ORIGIN, http, PROFILE, SESSION_EXPIRED } from './testing/http';

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const TAG = {
  id: '00000000-0000-4000-8000-000000000002',
  name: 'Arabic',
  scope: 'candidate',
  created_at: '2026-07-31T00:00:00Z',
} as const;

function wrapper(children: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe('the exported mutation hook', () => {
  it('posts through the hardened client and hands back the typed result', async () => {
    const requests: Request[] = [];
    server.events.on('request:start', ({ request }) => requests.push(request));
    server.use(http.post('/v1/tenants/me/tags', ({ response }) => response(201).json(TAG)));

    const { api } = createApiClient({ baseUrl: API_ORIGIN });

    function CreateTag() {
      const mutation = api.useMutation('post', '/v1/tenants/me/tags');
      return (
        <button
          type="button"
          onClick={() => mutation.mutate({ body: { name: 'Arabic', scope: 'candidate' } })}
        >
          {mutation.data?.name ?? 'create'}
        </button>
      );
    }

    render(wrapper(<CreateTag />));
    screen.getByRole('button', { name: 'create' }).click();

    await waitFor(() => expect(screen.getByRole('button', { name: 'Arabic' })).toBeDefined());
    expect(requests).toHaveLength(1);
    expect(requests[0]?.headers.get('X-Sync-Request')).toBe('1');
    expect(requests[0]?.credentials).toBe('include');
  });

  it('recovers an expired session mid-mutation, replaying it once', async () => {
    const requests: Request[] = [];
    let refreshed = false;
    server.events.on('request:start', ({ request }) => requests.push(request));
    server.use(
      http.post('/v1/tenants/me/tags', ({ response }) =>
        refreshed ? response(201).json(TAG) : response(401).json(SESSION_EXPIRED),
      ),
      http.post('/v1/auth/refresh', ({ response }) => {
        refreshed = true;
        return response(200).json(PROFILE);
      }),
    );

    const { api } = createApiClient({ baseUrl: API_ORIGIN });

    function CreateTag() {
      const mutation = api.useMutation('post', '/v1/tenants/me/tags');
      return (
        <button
          type="button"
          onClick={() => mutation.mutate({ body: { name: 'Arabic', scope: 'candidate' } })}
        >
          {mutation.data?.name ?? 'create'}
        </button>
      );
    }

    render(wrapper(<CreateTag />));
    screen.getByRole('button', { name: 'create' }).click();

    await waitFor(() => expect(screen.getByRole('button', { name: 'Arabic' })).toBeDefined());
    expect(requests.map((request) => new URL(request.url).pathname)).toEqual([
      '/v1/tenants/me/tags',
      '/v1/auth/refresh',
      '/v1/tenants/me/tags',
    ]);
  });
});

afterEach(() => server.events.removeAllListeners());
