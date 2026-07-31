import { createOpenApiHttp } from 'openapi-msw';
import type { components, paths } from '../schema.gen';

export const API_ORIGIN = 'http://sync.test';

export const http = createOpenApiHttp<paths>({ baseUrl: API_ORIGIN });

export const PROFILE: components['schemas']['ProfileView'] = {
  id: '00000000-0000-4000-8000-000000000001',
  email: 'candidate@sync.test',
  full_name: 'Test Candidate',
  account_type: 'candidate',
  avatar_url: null,
  phone: null,
};

export const SESSION_EXPIRED: components['schemas']['ProblemDetail'] = {
  type: 'about:blank',
  title: 'Unauthorized',
  status: 401,
};
