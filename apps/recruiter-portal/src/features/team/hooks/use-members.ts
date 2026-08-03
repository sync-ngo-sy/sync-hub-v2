import { api } from '@/lib/api';

export const MEMBERS_PATH = '/v1/tenants/me/members';
export const MEMBER_PATH = '/v1/tenants/me/members/{recruiter_id}';

export function membersQuery() {
  return api.queryOptions('get', MEMBERS_PATH, {});
}

export function useMembers() {
  return api.useQuery('get', MEMBERS_PATH, {});
}
