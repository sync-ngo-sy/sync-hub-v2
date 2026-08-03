import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { MEMBER_PATH, MEMBERS_PATH, membersQuery } from './use-members';

export function useInviteMember() {
  const queryClient = useQueryClient();

  return api.useMutation('post', MEMBERS_PATH, {
    onSuccess: () => queryClient.invalidateQueries({ queryKey: membersQuery().queryKey }),
  });
}

/** The roster is re-read whatever the answer, rather than patched: the role and the access flag
 * are the server's to write, and a refusal can itself be news — a caller who is no longer an
 * admin learns it from the roster, which is the only place their own role is written. */
export function useChangeMember() {
  const queryClient = useQueryClient();

  return api.useMutation('patch', MEMBER_PATH, {
    onSettled: () => queryClient.invalidateQueries({ queryKey: membersQuery().queryKey }),
  });
}
