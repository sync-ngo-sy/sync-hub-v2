import createClient, { type ClientOptions } from 'openapi-fetch';
import type { paths } from './schema.gen';

export type ApiClient = ReturnType<typeof createClient<paths>>;

/**
 * Create a fully-typed client for the FastAPI backend.
 * Paths, request bodies and responses are inferred from the generated schema.
 */
export function createApiClient(options: ClientOptions = {}): ApiClient {
  return createClient<paths>({
    baseUrl: 'http://localhost:8000',
    ...options,
  });
}

export type { paths } from './schema.gen';
