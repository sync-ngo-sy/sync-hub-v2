import type { HttpHandler } from 'msw';
import { http, HttpResponse } from 'msw';
import type { components } from '@sync/api-client/schema';
import { MANATAL_MIGRATION_PATH } from '../migration';

type ManatalMigrationStatus = components['schemas']['ManatalMigrationStatus'];

export function servesManatalMigration(status: ManatalMigrationStatus): HttpHandler[] {
  return [
    http.get(`*${MANATAL_MIGRATION_PATH}`, () => HttpResponse.json(status)),
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
