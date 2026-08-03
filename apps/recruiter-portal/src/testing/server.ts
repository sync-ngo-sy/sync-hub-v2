import { setupServer } from 'msw/node';
import {
  listsApplicationNotes,
  listsApplicationTags,
  listsMatchAssessments,
} from '@/features/applications/testing/handlers';
import { listsCandidateNotes, listsCandidateTags } from '@/features/candidates/testing/handlers';
import { listsJobs } from '@/features/jobs/testing/handlers';
import {
  hasCanonicalSkills,
  hasLanguages,
  hasLocations,
} from '@/features/reference/testing/handlers';
import { holdsTalentPool } from '@/features/talent-pool/testing/handlers';
import { listsMessageTemplates } from '@/features/templates/testing/handlers';
import { belongsToTenant } from '@/features/tenant/testing/handlers';
import { AMAN, CANONICAL_SKILLS, LANGUAGES, LOCATIONS } from './fixtures';

/**
 * The taxonomies are here because every picker asks for them, and only a test about the pickers
 * cares what comes back; one that does says otherwise with `server.use`. The Tenant, the
 * assessments, the notes, the tags and the talent pool are here for the same reason: the
 * Application review and the Candidate view always ask for all of them, and only a test about
 * those widgets cares what they answer.
 */
export const server = setupServer(
  ...listsJobs([]),
  ...listsMessageTemplates([]),
  ...listsApplicationNotes([]),
  ...listsApplicationTags([]),
  ...listsMatchAssessments([]),
  ...listsCandidateNotes([]),
  ...listsCandidateTags([]),
  ...holdsTalentPool([]),
  ...belongsToTenant(AMAN),
  ...hasCanonicalSkills(CANONICAL_SKILLS),
  ...hasLanguages(LANGUAGES),
  ...hasLocations(LOCATIONS),
);
