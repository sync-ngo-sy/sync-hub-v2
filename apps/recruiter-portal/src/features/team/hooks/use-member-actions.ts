import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { MEMBER_PATH, MEMBERS_PATH, membersQuery } from './use-members';

export function useInviteMember() {
  const queryClient = useQueryClient();

  return api.useMutation('post', MEMBERS_PATH, {
    onSuccess: () => queryClient.invalidateQueries({ queryKey: membersQuery().queryKey }),
  });
}

export function useChangeMember() {
  const queryClient = useQueryClient();

  return api.useMutation('patch', MEMBER_PATH, {
    onSettled: () => queryClient.invalidateQueries({ queryKey: membersQuery().queryKey }),
  });
}
