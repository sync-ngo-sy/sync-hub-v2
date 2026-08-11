import { setupServer } from 'msw/node';
import { listsApplications } from '@/features/applications/testing/handlers';
import { signedOut } from '@/features/auth/testing/handlers';
import { listsCvs } from '@/features/cvs/testing/handlers';
import { listsJobs } from '@/features/jobs/testing/handlers';
import { countsUnread, listsNotifications } from '@/features/notifications/testing/handlers';
import {
  hasCanonicalRoles,
  hasCanonicalSkills,
  hasLanguages,
  hasLocations,
} from '@/features/reference/testing/handlers';
import { CANONICAL_ROLES, CANONICAL_SKILLS, LANGUAGES, LOCATIONS } from './fixtures';

export const server = setupServer(
  ...countsUnread(0),
  ...listsNotifications([]),
  ...hasCanonicalSkills(CANONICAL_SKILLS),
  ...hasLanguages(LANGUAGES),
  ...hasLocations(LOCATIONS),
  ...hasCanonicalRoles(CANONICAL_ROLES),
  ...listsCvs([]),
  ...listsApplications([]),
  ...listsJobs([]),
  ...signedOut(),
);
