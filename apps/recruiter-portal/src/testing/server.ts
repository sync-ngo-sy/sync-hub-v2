import type { paths } from '@sync/api-client/schema';
import { setupServer } from 'msw/node';
import { createOpenApiHttp } from 'openapi-msw';

/** Matches `VITE_API_BASE_URL` in the Vitest config, which is jsdom's own origin. */
const API_ORIGIN = 'http://localhost:3000';

export const http = createOpenApiHttp<paths>({ baseUrl: API_ORIGIN });

export const server = setupServer();
