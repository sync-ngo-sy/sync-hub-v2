import { describe, expect, it } from 'vitest';
import { parseAdminPortalUrl, parseCandidatePortalUrl } from './env';

describe('recruiter portal environment', () => {
  it.each(['ftp://admin.sync.test', 'javascript:alert(1)'])(
    'rejects %j as an admin portal URL',
    (value) => {
      expect(() => parseAdminPortalUrl(value)).toThrow(/VITE_ADMIN_PORTAL_URL/);
    },
  );

  it.each(['ftp://candidates.sync.test', 'javascript:alert(1)'])(
    'rejects %j as a candidate portal URL, so a tracked link cannot be built on it',
    (value) => {
      expect(() => parseCandidatePortalUrl(value)).toThrow(/VITE_CANDIDATE_PORTAL_URL/);
    },
  );
});
