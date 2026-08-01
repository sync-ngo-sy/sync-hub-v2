import { setupServer } from 'msw/node';
import { countsUnread, listsNotifications } from '@/features/notifications/testing/handlers';

/**
 * The bell lives in the account shell, so every signed-in render asks what it should say. These
 * two answer "nothing to report" for tests that are about something else; a test that cares says
 * otherwise with `server.use`.
 */
export const server = setupServer(...countsUnread(0), ...listsNotifications([]));
