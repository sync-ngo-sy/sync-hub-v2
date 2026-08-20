import { describe, expect, it } from 'vitest';
import { accessRefusal } from './refusal';

const REFUSAL = { title: 'Forbidden', status: 403, detail: 'Ask an admin.' };

describe('the refusal a Tenant reading answers with', () => {
  it('reads a recruiter whose access an admin turned off', () => {
    expect(accessRefusal({ ...REFUSAL, type: 'urn:sync:problem:recruiter-deactivated' })).toBe(
      'recruiter-deactivated',
    );
  });

  it('reads a tenant the platform suspended', () => {
    expect(accessRefusal({ ...REFUSAL, type: 'urn:sync:problem:tenant-suspended' })).toBe(
      'tenant-suspended',
    );
  });

  it('leaves every other refusal to the page that asked', () => {
    expect(accessRefusal({ ...REFUSAL, type: 'urn:sync:problem:recruiter-only' })).toBeNull();
    expect(accessRefusal({ ...REFUSAL, type: 'urn:sync:problem:tenant-admin-only' })).toBeNull();
  });

  it('has nothing to read when the request never reached the API', () => {
    expect(accessRefusal(new TypeError('Failed to fetch'))).toBeNull();
    expect(accessRefusal(undefined)).toBeNull();
  });
});
