import { createOpenApiHttp } from 'openapi-msw';
import type { components, paths } from '../schema.gen';

export const API_ORIGIN = 'http://sync.test';

export const http = createOpenApiHttp<paths>({ baseUrl: API_ORIGIN });

export const PROFILE: components['schemas']['ProfileView'] = {
  id: 'p_test',
  email: 'candidate@sync.test',
  full_name: 'Test Candidate',
  account_type: 'candidate',
  avatar_url: null,
  phone: null,
};

export const PROBLEM: components['schemas']['ProblemDetail'] = {
  type: 'about:blank',
  title: 'Unauthorized',
  status: 401,
};
