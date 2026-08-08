import type { components } from '@sync/api-client';
import type { StatusTone } from '@sync/ui/components/status-mark';

export type Member = components['schemas']['MemberView'];
export type RecruiterRole = components['schemas']['RecruiterRole'];
export type NewMember = components['schemas']['InviteMemberRequest'];
export type MemberChanges = components['schemas']['ChangeMemberRequest'];

export const RECRUITER_ROLES = ['recruiter', 'admin'] as const satisfies readonly RecruiterRole[];

export const ROLE_LABELS: Record<RecruiterRole, string> = {
  admin: 'Admin',
  recruiter: 'Recruiter',
};

export const ROLE_DESCRIPTIONS: Record<RecruiterRole, string> = {
  admin: 'Everything a Recruiter does, and the team: invitations, roles and access.',
  recruiter: 'Works Jobs, Applications and the CRM.',
};

const ROLE_IN_A_SENTENCE: Record<RecruiterRole, string> = {
  admin: 'an admin',
  recruiter: 'a recruiter',
};

export function isTenantAdmin(members: Member[], profileId: string): boolean {
  return members.some(
    (member) => member.id === profileId && member.role === 'admin' && member.is_active,
  );
}

export function memberAccess(member: Member): { label: string; tone: StatusTone } {
  return member.is_active
    ? { label: 'Active', tone: 'active' }
    : { label: 'No access', tone: 'ended' };
}

export type MemberChangeKey =
  | 'make-admin'
  | 'make-recruiter'
  | 'revoke'
  | 'reinstate'
  | 'step-down';

export interface MemberChange {
  key: MemberChangeKey;
  label: string;
  title: string;
  description: string;
  confirmLabel: string;
  pendingLabel: string;
  body: MemberChanges;
  success: string;
  destructive: boolean;
}

function makeAdmin(member: Member): MemberChange {
  return {
    key: 'make-admin',
    label: 'Make admin',
    title: `Make ${member.full_name} an admin?`,
    description:
      'An admin invites teammates and changes any colleague’s role or access. Everything else about their work stays as it is.',
    confirmLabel: 'Make admin',
    pendingLabel: 'Making admin…',
    body: { role: 'admin' },
    success: `${member.full_name} is now an admin`,
    destructive: false,
  };
}

function makeRecruiter(member: Member): MemberChange {
  return {
    key: 'make-recruiter',
    label: 'Make recruiter',
    title: `Make ${member.full_name} a recruiter?`,
    description:
      'They keep everything a Recruiter works on, and stop being able to invite teammates or change anyone’s access.',
    confirmLabel: 'Make recruiter',
    pendingLabel: 'Making recruiter…',
    body: { role: 'recruiter' },
    success: `${member.full_name} is now a recruiter`,
    destructive: false,
  };
}

function stepDown(): MemberChange {
  return {
    key: 'step-down',
    label: 'Step down to recruiter',
    title: 'Step down to recruiter?',
    description:
      'You keep everything a Recruiter works on, and stop being able to invite teammates or change anyone’s access. Only another admin can make you one again.',
    confirmLabel: 'Step down',
    pendingLabel: 'Stepping down…',
    body: { role: 'recruiter' },
    success: 'You are a recruiter now',
    destructive: false,
  };
}

function revoke(member: Member): MemberChange {
  return {
    key: 'revoke',
    label: 'Revoke access',
    title: `Revoke ${member.full_name}’s access?`,
    description:
      'They can no longer sign in. They stay on the roster, and everything they wrote stays with your Tenant — an admin can give their access back.',
    confirmLabel: 'Revoke access',
    pendingLabel: 'Revoking access…',
    body: { is_active: false },
    success: `${member.full_name} can no longer sign in`,
    destructive: true,
  };
}

function reinstate(member: Member): MemberChange {
  return {
    key: 'reinstate',
    label: 'Give access back',
    title: `Give ${member.full_name} their access back?`,
    description: `They can sign in again, as ${ROLE_IN_A_SENTENCE[member.role]}.`,
    confirmLabel: 'Give access back',
    pendingLabel: 'Giving access back…',
    body: { is_active: true },
    success: `${member.full_name} can sign in again`,
    destructive: false,
  };
}

export function memberChanges(member: Member, profileId: string): MemberChange[] {
  if (member.id === profileId) {
    return member.role === 'admin' && member.is_active ? [stepDown()] : [];
  }
  if (!member.is_active) return [reinstate(member)];

  return [member.role === 'admin' ? makeRecruiter(member) : makeAdmin(member), revoke(member)];
}
