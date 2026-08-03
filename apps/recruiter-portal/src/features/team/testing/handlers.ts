import type { components } from '@sync/api-client';
import { http } from '@sync/api-client/testing';
import { MEMBER_PATH, MEMBERS_PATH } from '../hooks/use-members';
import type { Member, MemberChanges, NewMember } from '../member';

type Problem = components['schemas']['ProblemDetail'];

const NO_SUCH_MEMBER: Problem = {
  type: 'urn:sync:problem:member-not-found',
  title: 'Not Found',
  status: 404,
  detail: 'No such member of this tenant.',
};

export function listsMembers(members: Member[]) {
  return [http.get(MEMBERS_PATH, ({ response }) => response(200).json(members))];
}

export function failsToListMembers(problem: Problem) {
  return [http.get(MEMBERS_PATH, ({ response }) => response(500).json(problem))];
}

export function refusesTeamInvite(problem: Problem) {
  return [http.post(MEMBERS_PATH, ({ response }) => response(409).json(problem))];
}

export function refusesTeamInviteToNonAdmins(problem: Problem) {
  return [http.post(MEMBERS_PATH, ({ response }) => response(403).json(problem))];
}

export function refusesMemberChange(problem: Problem) {
  return [http.patch(MEMBER_PATH, ({ response }) => response(409).json(problem))];
}

export function refusesMemberChangeToNonAdmins(problem: Problem) {
  return [http.patch(MEMBER_PATH, ({ response }) => response(403).json(problem))];
}

export interface TeamSpies {
  onInvite?: (body: NewMember) => void;
  onChange?: (recruiterId: string, body: MemberChanges) => void;
}

export function managesTeam(initial: Member[], spies: TeamSpies = {}) {
  let roster = [...initial];
  let invited = 0;

  return [
    http.get(MEMBERS_PATH, ({ response }) => response(200).json(roster)),

    http.post(MEMBERS_PATH, async ({ request, response }) => {
      const body = (await request.json()) as NewMember;
      spies.onInvite?.(body);

      invited += 1;
      const member: Member = {
        id: `00000000-0000-4000-8000-0000000000${String(20 + invited)}`,
        full_name: body.full_name,
        email: body.email,
        role: body.role,
        is_active: true,
      };
      roster = [...roster, member];
      return response(201).json(member);
    }),

    http.patch(MEMBER_PATH, async ({ params, request, response }) => {
      const changes = (await request.json()) as MemberChanges;
      const current = roster.find((member) => member.id === params.recruiter_id);
      if (!current) return response(404).json(NO_SUCH_MEMBER);

      spies.onChange?.(params.recruiter_id, changes);
      const changed: Member = {
        ...current,
        role: changes.role ?? current.role,
        is_active: changes.is_active ?? current.is_active,
      };
      roster = roster.map((member) => (member.id === changed.id ? changed : member));
      return response(200).json(changed);
    }),
  ];
}
