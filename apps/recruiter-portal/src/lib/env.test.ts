import { describe, expect, it } from 'vitest';
import { parseAdminPortalUrl } from './env';

describe('recruiter portal environment', () => {
  it.each(['ftp://admin.sync.test', 'javascript:alert(1)'])(
    'rejects %j as an admin portal URL',
    (value) => {
      expect(() => parseAdminPortalUrl(value)).toThrow(/VITE_ADMIN_PORTAL_URL/);
    },
  );
});
