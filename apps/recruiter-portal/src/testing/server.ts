import { setupServer } from 'msw/node';
import {
  listsApplicationNotes,
  listsApplicationTags,
  listsMatchAssessments,
} from '@/features/applications/testing/handlers';
import { listsJobs } from '@/features/jobs/testing/handlers';
import {
  hasCanonicalSkills,
  hasLanguages,
  hasLocations,
} from '@/features/reference/testing/handlers';
import { listsMessageTemplates } from '@/features/templates/testing/handlers';
import { belongsToTenant } from '@/features/tenant/testing/handlers';
import { AMAN, CANONICAL_SKILLS, LANGUAGES, LOCATIONS } from './fixtures';

/**
 * The taxonomies are here because every picker asks for them, and only a test about the pickers
 * cares what comes back; one that does says otherwise with `server.use`. The Tenant, the
 * assessments, the notes and the tags are here for the same reason: the Application review always
 * asks for all of them, and only a test about those widgets cares what they answer.
 */
export const server = setupServer(
  ...listsJobs([]),
  ...listsMessageTemplates([]),
  ...listsApplicationNotes([]),
  ...listsApplicationTags([]),
  ...listsMatchAssessments([]),
  ...belongsToTenant(AMAN),
  ...hasCanonicalSkills(CANONICAL_SKILLS),
  ...hasLanguages(LANGUAGES),
  ...hasLocations(LOCATIONS),
);
