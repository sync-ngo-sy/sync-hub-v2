import type { components } from '@sync/api-client';
import { type ProfileFormValues, toFormValues } from './schemas/profile';

export type ProfileDraft = components['schemas']['ProfileDraft'];

type Skill = ProfileFormValues['skills'][number];

/**
 * Skills are the one section that merges, because they are the one with a natural key — the
 * Canonical name — so the years already typed against a skill survive a fill. The CV's own are
 * appended, and a skill it newly names arrives with its years blank: zero and blank are
 * opposite answers, and only the candidate can say which.
 */
function mergedSkills(kept: Skill[], fromCv: Skill[]): Skill[] {
  const listed = new Set(kept.map((skill) => skill.name));
  return [...kept, ...fromCv.filter((skill) => !listed.has(skill.name))];
}

/**
 * The form, as this CV would have it. Nothing is saved by it — the candidate reads the fields in
 * place, edits whatever they like, and presses Save, which is the only thing that writes.
 *
 * Every section but skills is replaced rather than merged, exactly as the draft endpoint has
 * always meant it: an experience or a project has no key to match on, and matching by shape
 * would leave duplicates behind to delete by hand. Undo is what makes replacement safe.
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
