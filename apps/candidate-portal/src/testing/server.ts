import { setupServer } from 'msw/node';
import { countsUnread, listsNotifications } from '@/features/notifications/testing/handlers';
import { hasCanonicalSkills, hasLanguages } from '@/features/reference/testing/handlers';
import { CANONICAL_SKILLS, LANGUAGES } from './fixtures';

/**
 * The bell lives in the account shell, so every signed-in render asks what it should say. These
 * two answer "nothing to report" for tests that are about something else; a test that cares says
 * otherwise with `server.use`.
 *
 * The taxonomies are here for the same reason: every picker asks for them, and only a test about
 * the pickers cares what comes back.
 */
export const server = setupServer(
  ...countsUnread(0),
  ...listsNotifications([]),
  ...hasCanonicalSkills(CANONICAL_SKILLS),
  ...hasLanguages(LANGUAGES),
);
