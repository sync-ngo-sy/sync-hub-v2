import type { components } from '@sync/api-client/schema';

export type ProfileDraft = components['schemas']['ProfileDraft'];
export type CandidateProfile = components['schemas']['CandidateProfile'];
export type DraftSkill = components['schemas']['DraftSkill'];

export function skillNeedsYears(skill: DraftSkill): boolean {
  return skill.years_experience == null;
}

export function draftToProfile(
  draft: ProfileDraft,
  skillYears: Record<string, number>,
): CandidateProfile {
  const skills = (draft.skills ?? []).map((skill) => ({
    name: skill.name,
    years_experience: skill.years_experience ?? skillYears[skill.name] ?? 0,
  }));
  return { ...draft, skills };
}
