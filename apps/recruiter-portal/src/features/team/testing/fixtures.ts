import type { components } from '@sync/api-client';
import { RECRUITER } from '@/testing/fixtures';
import type { Member } from '../member';

export const RANA: Member = {
  id: RECRUITER.id,
  full_name: RECRUITER.full_name,
  email: RECRUITER.email,
  role: 'admin',
  is_active: true,
};

export const OMAR: Member = {
  id: '00000000-0000-4000-8000-000000000012',
  full_name: 'Omar Zayed',
  email: 'omar@aman.test',
  role: 'recruiter',
  is_active: true,
};

export const LAYLA: Member = {
  id: '00000000-0000-4000-8000-000000000013',
  full_name: 'Layla Haddad',
  email: 'layla@aman.test',
  role: 'recruiter',
  is_active: false,
};

export const ADMIN_ONLY: components['schemas']['ProblemDetail'] = {
  type: 'urn:sync:problem:tenant-admin-only',
  title: 'Forbidden',
  status: 403,
  detail: 'Only a tenant admin can do this.',
};

export const LAST_ADMIN: components['schemas']['ProblemDetail'] = {
  type: 'urn:sync:problem:last-tenant-admin',
  title: 'Conflict',
  status: 409,
  detail: 'A tenant has to keep at least one active admin.',
};

export const EMAIL_TAKEN: components['schemas']['ProblemDetail'] = {
  type: 'urn:sync:problem:email-already-registered',
  title: 'Conflict',
  status: 409,
  detail: 'An account already exists for this email address.',
};
