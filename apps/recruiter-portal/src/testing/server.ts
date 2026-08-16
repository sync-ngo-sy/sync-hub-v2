import { setupServer } from 'msw/node';
import {
  listsApplicationNotes,
  listsApplicationTags,
  readsMatchAssessment,
} from '@/features/applications/testing/handlers';
import { signedOut } from '@/features/auth/testing/handlers';
import {
  listsCandidateNotes,
  listsCandidateTags,
  listsDirectoryCandidates,
} from '@/features/candidates/testing/handlers';
import { listsJobs } from '@/features/jobs/testing/handlers';
import {
  hasCanonicalRoles,
  hasCanonicalSkills,
  hasLanguages,
  hasLocations,
} from '@/features/reference/testing/handlers';
import { holdsTalentPool } from '@/features/talent-pool/testing/handlers';
import { listsMessageTemplates } from '@/features/templates/testing/handlers';
import { belongsToTenant } from '@/features/tenant/testing/handlers';
import { AMAN, CANONICAL_ROLES, CANONICAL_SKILLS, LANGUAGES, LOCATIONS } from './fixtures';

export const server = setupServer(
  ...listsJobs([]),
  ...listsMessageTemplates([]),
  ...listsApplicationNotes([]),
  ...listsApplicationTags([]),
  ...readsMatchAssessment(null),
  ...listsCandidateNotes([]),
  ...listsCandidateTags([]),
  ...listsDirectoryCandidates([]),
  ...holdsTalentPool([]),
  ...belongsToTenant(AMAN),
  ...hasCanonicalSkills(CANONICAL_SKILLS),
  ...hasCanonicalRoles(CANONICAL_ROLES),
  ...hasLanguages(LANGUAGES),
  ...hasLocations(LOCATIONS),
  ...signedOut(),
);
