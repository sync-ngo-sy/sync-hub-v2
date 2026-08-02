import { setupServer } from 'msw/node';
import { listsCvs } from '@/features/cvs/testing/handlers';
import { countsUnread, listsNotifications } from '@/features/notifications/testing/handlers';
import {
  hasCanonicalSkills,
  hasLanguages,
  hasLocations,
} from '@/features/reference/testing/handlers';
import { CANONICAL_SKILLS, LANGUAGES, LOCATIONS } from './fixtures';

/**
 * The bell lives in the account shell, so every signed-in render asks what it should say. These
 * two answer "nothing to report" for tests that are about something else; a test that cares says
 * otherwise with `server.use`.
 *
 * The taxonomies are here for the same reason: every picker asks for them, and only a test about
 * the pickers cares what comes back. So are the CVs: they are the profile editor's first section,
 * so every render of it asks, including the tests that are about a field further down.
 */
export const server = setupServer(
  ...countsUnread(0),
  ...listsNotifications([]),
  ...hasCanonicalSkills(CANONICAL_SKILLS),
  ...hasLanguages(LANGUAGES),
  ...hasLocations(LOCATIONS),
  ...listsCvs([]),
);
