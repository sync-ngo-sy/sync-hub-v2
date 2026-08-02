import type { components } from '@sync/api-client';
import { type ProfileFormValues, toFormValues } from './schemas/profile';

export type ProfileDraft = components['schemas']['ProfileDraft'];

type Skill = ProfileFormValues['skills'][number];

/**
 * Skills merge because they have a natural key — the Canonical name — so the years already typed
 * against one survive. A skill the CV newly names arrives blank: zero and blank are opposite
 * answers, and only the candidate can say which.
 */
function mergedSkills(kept: Skill[], fromCv: Skill[]): Skill[] {
  const listed = new Set(kept.map((skill) => skill.name));
  return [...kept, ...fromCv.filter((skill) => !listed.has(skill.name))];
}

/**
 * The form, as this CV would have it. Nothing is saved by it. Every section but skills is
 * replaced, as the draft endpoint has always meant it — an experience has no key to match on, and
 * matching by shape would leave duplicates to delete by hand. Undo is what makes that safe.
 */
export function filledFromCv(current: ProfileFormValues, draft: ProfileDraft): ProfileFormValues {
  const fromCv = toFormValues(draft);

  return {
    ...fromCv,
    // A CV cannot speak for any of these three: where the candidate is, is a Location they chose
    // from a list, not the address a document prints; the language to write to them in is a
    // setting; and Global search is an opt-in. The draft carries the *saved* copies, so taking
    // them would revert edits the form is still holding.
    location_key: current.location_key,
    preferred_language_code: current.preferred_language_code,
    is_searchable: current.is_searchable,
    skills: mergedSkills(current.skills, fromCv.skills),
  };
}
