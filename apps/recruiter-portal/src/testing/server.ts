import { setupServer } from 'msw/node';
import { listsJobs } from '@/features/jobs/testing/handlers';
import { hasCanonicalSkills, hasLanguages } from '@/features/reference/testing/handlers';
import { CANONICAL_SKILLS, LANGUAGES } from './fixtures';

/**
 * The taxonomies are here because every picker asks for them, and only a test about the pickers
 * cares what comes back; one that does says otherwise with `server.use`.
 */
export const server = setupServer(
  ...listsJobs([]),
  ...hasCanonicalSkills(CANONICAL_SKILLS),
  ...hasLanguages(LANGUAGES),
);
