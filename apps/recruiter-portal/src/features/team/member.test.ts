import { describe, expect, it } from 'vitest';
import { isTenantAdmin, type Member, memberAccess, memberChanges } from './member';

function member(overrides: Partial<Member> = {}): Member {
  return {
    id: '00000000-0000-4000-8000-000000000011',
    full_name: 'Rana Aljabri',
    email: 'rana@aman.test',
    role: 'recruiter',
    is_active: true,
    ...overrides,
  };
}

const YOU = member({ id: 'you', full_name: 'Rana Aljabri', role: 'admin' });
const OMAR = member({ id: 'omar', full_name: 'Omar Zayed' });

const keys = (one: Member) => memberChanges(one, 'you').map((change) => change.key);

describe('who on the roster may administer the team', () => {
  it('is an admin the roster lists as active', () => {
    expect(isTenantAdmin([YOU, OMAR], 'you')).toBe(true);
  });

  it('is not a recruiter, whatever else the roster says', () => {
    expect(isTenantAdmin([member({ id: 'you', role: 'recruiter' })], 'you')).toBe(false);
  });

  it('is not an admin whose access has been revoked', () => {
    expect(isTenantAdmin([{ ...YOU, is_active: false }], 'you')).toBe(false);
  });

  it('is nobody at all while the roster has not arrived', () => {
    expect(isTenantAdmin([], 'you')).toBe(false);
  });
});

describe('what the roster says about a colleague’s access', () => {
  it('reads as active while they can sign in', () => {
    expect(memberAccess(OMAR)).toEqual({ label: 'Active', tone: 'positive' });
  });

  it('names the revoked state rather than colouring it', () => {
    expect(memberAccess({ ...OMAR, is_active: false })).toEqual({
      label: 'No access',
      tone: 'negative',
    });
  });
});

describe('the changes an admin may make to a colleague', () => {
  it('offers to promote an active recruiter, and to revoke their access', () => {
    expect(keys(OMAR)).toEqual(['make-admin', 'revoke']);
  });

  it('offers to demote another active admin, and to revoke their access', () => {
    expect(keys({ ...OMAR, role: 'admin' })).toEqual(['make-recruiter', 'revoke']);
  });

  it('offers a colleague with no access one move: giving it back', () => {
    expect(keys({ ...OMAR, is_active: false })).toEqual(['reinstate']);
  });

  it('offers to step down on your own row, and never to revoke your own access', () => {
    expect(keys(YOU)).toEqual(['step-down']);
  });

  it('offers nothing on your own row once you are not an admin of it', () => {
    expect(keys({ ...YOU, role: 'recruiter' })).toEqual([]);
    expect(keys({ ...YOU, is_active: false })).toEqual([]);
  });

  it('writes the step down for the admin taking it, not about a colleague', () => {
    const [down] = memberChanges(YOU, 'you');
    expect(down?.title).toBe('Step down to recruiter?');
    expect(down?.body).toEqual({ role: 'recruiter' });
    expect(down?.success).toBe('You are a recruiter now');
  });

  it('sends the role, and nothing about access, when only the role changes', () => {
    const [promote] = memberChanges(OMAR, 'you');
    expect(promote?.body).toEqual({ role: 'admin' });
  });

  it('sends the access, and nothing about the role, when only access changes', () => {
    const [, revoke] = memberChanges(OMAR, 'you');
    expect(revoke?.body).toEqual({ is_active: false });
    expect(memberChanges({ ...OMAR, is_active: false }, 'you')[0]?.body).toEqual({
      is_active: true,
    });
  });

  it('names the colleague in what it asks and in what it reports', () => {
    const [promote] = memberChanges(OMAR, 'you');
    expect(promote?.title).toBe('Make Omar Zayed an admin?');
    expect(promote?.success).toBe('Omar Zayed is now an admin');
  });
});
