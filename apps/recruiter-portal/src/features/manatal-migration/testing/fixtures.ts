import type { components } from '@sync/api-client/schema';

type ManatalMigrationStatus = components['schemas']['ManatalMigrationStatus'];

export const NO_IMPORT_YET: ManatalMigrationStatus = {
  configured: true,
  may_start: true,
  counts: {
    total: 0,
    published: 0,
    complete: 0,
    unclaimed: 0,
    awaiting_parse: 0,
    parse_failed: 0,
    with_linkedin: 0,
  },
  queue: {
    ledger_pending: 0,
    ledger_imported: 0,
    jobs_pending: 0,
    jobs_processing: 0,
    jobs_failed: 0,
  },
  recent: [],
};

export const PARTWAY_THROUGH: ManatalMigrationStatus = {
  configured: true,
  may_start: true,
  counts: {
    total: 12,
    published: 8,
    complete: 8,
    unclaimed: 10,
    awaiting_parse: 2,
    parse_failed: 1,
    with_linkedin: 6,
  },
  queue: {
    ledger_pending: 3,
    ledger_imported: 2,
    jobs_pending: 1,
    jobs_processing: 0,
    jobs_failed: 0,
  },
  recent: [
    {
      candidate_id: '11111111-1111-4111-8111-111111111111',
      full_name: 'Amina Haddad',
      email: 'amina@example.com',
      is_claimed: false,
      is_searchable: true,
      parsing_status: 'ready',
      saved_at: '2026-08-20T08:00:00+00:00',
    },
    {
      candidate_id: '22222222-2222-4222-8222-222222222222',
      full_name: 'Omar Zayed',
      email: 'omar@example.com',
      is_claimed: false,
      is_searchable: false,
      parsing_status: 'parsing',
      saved_at: '2026-08-20T07:30:00+00:00',
    },
  ],
};
