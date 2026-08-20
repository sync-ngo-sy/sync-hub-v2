import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { manatalMigrationQuery } from './use-manatal-migration-status';
import { MANATAL_MIGRATION_START_PATH } from '../migration';

export function useStartManatalMigration() {
  const queryClient = useQueryClient();

  return api.useMutation('post', MANATAL_MIGRATION_START_PATH, {
    onSuccess: () => queryClient.invalidateQueries({ queryKey: manatalMigrationQuery().queryKey }),
  });
}
