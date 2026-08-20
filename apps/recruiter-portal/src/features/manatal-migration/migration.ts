import type { components } from '@sync/api-client/schema';

export const MANATAL_MIGRATION_PATH = '/v1/tenants/me/manatal-migration';
export const MANATAL_MIGRATION_START_PATH = '/v1/tenants/me/manatal-migration/start';

export type ManatalMigrationCounts = components['schemas']['ManatalMigrationCounts'];
export type ManatalMigrationRecent = components['schemas']['ManatalMigrationRecent'];
export type ManatalMigrationStatus = components['schemas']['ManatalMigrationStatus'];

export function progressLabel(counts: ManatalMigrationCounts): string {
  if (counts.total === 0) {
    return 'No Manatal candidates in your talent pool yet.';
  }
  return `${counts.published} of ${counts.total} imported profiles are published and searchable.`;
}

export function parseStatusLabel(status: string | null): string {
  if (status === null) {
    return 'No CV yet';
  }
  switch (status) {
    case 'ready':
      return 'CV read';
    case 'failed':
      return 'CV could not be read';
    case 'uploaded':
    case 'queued':
    case 'parsing':
      return 'CV being read';
    default:
      return status;
  }
}
