import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { myTenantQuery } from './use-my-tenant';

const UPLOAD_FILENAME = 'logo.webp';

export function logoUpload(logo: File) {
  return {
    body: { file: UPLOAD_FILENAME },
    bodySerializer: () => {
      const form = new FormData();
      form.set('file', logo, logo.name);
      return form;
    },
  };
}

export function useUploadLogo() {
  const queryClient = useQueryClient();

  return api.useMutation('put', '/v1/tenants/me/logo', {
    onSuccess: () => queryClient.invalidateQueries({ queryKey: myTenantQuery().queryKey }),
  });
}
