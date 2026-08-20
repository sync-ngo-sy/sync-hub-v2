import type { components } from '@sync/api-client';
import { type ProfileFormValues, toFormValues } from './schemas/profile';

export type ProfileDraft = components['schemas']['ProfileDraft'];

type Skill = ProfileFormValues['skills'][number];

function mergedSkills(kept: Skill[], fromCv: Skill[]): Skill[] {
  const listed = new Set(kept.map((skill) => skill.name));
  return [...kept, ...fromCv.filter((skill) => !listed.has(skill.name))];
}

export function updatedFromCv(current: ProfileFormValues, draft: ProfileDraft): ProfileFormValues {
  const fromCv = toFormValues(draft);

  return {
    ...fromCv,
    location_key: current.location_key,
    is_searchable: current.is_searchable,
    skills: mergedSkills(current.skills, fromCv.skills),
  };
}
