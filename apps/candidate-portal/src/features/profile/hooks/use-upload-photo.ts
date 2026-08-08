import { useQueryClient } from '@tanstack/react-query';
import {
  currentProfileQuery,
  type Profile,
  rememberCurrentProfile,
} from '@/features/auth/current-profile';
import { api } from '@/lib/api';

export const UPLOAD_FILENAME = 'photo.webp';

export function photoUpload(photo: Blob) {
  return {
    body: { file: UPLOAD_FILENAME },
    bodySerializer: () => {
      const form = new FormData();
      form.set('file', photo, UPLOAD_FILENAME);
      return form;
    },
  };
}

export function useUploadPhoto() {
  const queryClient = useQueryClient();

  return api.useMutation('put', '/v1/candidates/me/avatar', {
    onSuccess: ({ avatar_url }) => {
      const profile = queryClient.getQueryData<Profile>(currentProfileQuery.queryKey);
      if (profile) rememberCurrentProfile(queryClient, { ...profile, avatar_url });
    },
  });
}
