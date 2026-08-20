import { api } from '@/lib/api';
import { MANATAL_MIGRATION_PATH } from '../migration';

export function manatalMigrationQuery() {
  return api.queryOptions('get', MANATAL_MIGRATION_PATH, {});
}

export function useManatalMigrationStatus() {
  return api.useQuery('get', MANATAL_MIGRATION_PATH, {}, { throwOnError: true });
}
