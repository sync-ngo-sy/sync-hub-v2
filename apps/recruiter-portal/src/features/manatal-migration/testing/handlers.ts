import type { HttpHandler } from 'msw';
import { http, HttpResponse } from 'msw';
import type { components } from '@sync/api-client/schema';
import { MANATAL_MIGRATION_PATH, MANATAL_MIGRATION_START_PATH } from '../migration';

type ManatalMigrationStatus = components['schemas']['ManatalMigrationStatus'];
type ManatalMigrationStartResponse = components['schemas']['ManatalMigrationStartResponse'];

export function servesManatalMigration(status: ManatalMigrationStatus): HttpHandler[] {
  return [
    http.get(`*${MANATAL_MIGRATION_PATH}`, () => HttpResponse.json(status)),
    http.post(`*${MANATAL_MIGRATION_START_PATH}`, async ({ request }) => {
      const body = (await request.json()) as { action?: string };
      return HttpResponse.json({
        action: body.action ?? 'import',
        jobs_enqueued: body.action === 'publish' ? 2 : 1,
      } satisfies ManatalMigrationStartResponse);
    }),
  ];
}

export function failsManatalMigration(status = 500): HttpHandler[] {
  return [
    http.get(`*${MANATAL_MIGRATION_PATH}`, () =>
      HttpResponse.json(
        { type: 'about:blank', title: 'Server error', status },
        { status },
      ),
    ),
  ];
}
