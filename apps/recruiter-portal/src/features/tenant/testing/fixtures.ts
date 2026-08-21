import type { components } from '@sync/api-client';

export const ACCESS_TURNED_OFF: components['schemas']['ProblemDetail'] = {
  type: 'urn:sync:problem:recruiter-deactivated',
  title: 'Forbidden',
  status: 403,
  detail: 'Your access to this tenant has been turned off by an admin.',
};

export const TENANT_SUSPENDED: components['schemas']['ProblemDetail'] = {
  type: 'urn:sync:problem:tenant-suspended',
  title: 'Forbidden',
  status: 403,
  detail: 'This tenant is suspended. Contact Sync Hub to restore it.',
};
