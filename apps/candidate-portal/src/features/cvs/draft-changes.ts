import type { components } from '@sync/api-client';

export type CandidateProfile = components['schemas']['CandidateProfile'];
export type ProfileDraft = components['schemas']['ProfileDraft'];

export interface DraftChange {
  label: string;
  before: string;
  after: string;
  /**
   * Skills are the one section the API merges rather than replaces: `_merged_skills` returns
   * every saved skill with the years the candidate typed, then adds the ones this CV names.
   * Nothing already on the profile is lost, so this row must not read as an overwrite.
   */
  merges?: boolean;
}

const NOTHING = '—';

type TextKey = 'full_name' | 'phone' | 'headline' | 'summary' | 'location';
type ListKey = 'experiences' | 'educations' | 'languages' | 'projects';

const TEXT_FIELDS: [key: TextKey, label: string][] = [
  ['full_name', 'Name'],
  ['phone', 'Phone'],
  ['headline', 'Headline'],
  ['summary', 'Summary'],
  ['location', 'Location'],
];

const LIST_FIELDS: [key: ListKey, label: string][] = [
  ['experiences', 'Experience'],
  ['educations', 'Education'],
  ['languages', 'Languages'],
  ['projects', 'Projects'],
];

function text(value: string | null | undefined): string {
  return value?.trim() ? value : '';
}

function counted(count: number, singular: string, plural: string): string {
  if (count === 0) return 'Nothing';
  return count === 1 ? `1 ${singular}` : `${count} ${plural}`;
}

const entries = (count: number) => counted(count, 'entry', 'entries');
const skillCount = (count: number) => counted(count, 'skill', 'skills');

function sameShape(before: unknown, after: unknown): boolean {
  return JSON.stringify(before ?? []) === JSON.stringify(after ?? []);
}

/**
 * The reader's question is "what happens to my profile if I say yes". Sections answer it by
 * count, because the `PUT` replaces them whole and a list of every entry would bury that.
 */
export function draftChanges(current: CandidateProfile, draft: ProfileDraft): DraftChange[] {
  const changes: DraftChange[] = [];

  for (const [key, label] of TEXT_FIELDS) {
    const before = text(current[key]);
    const after = text(draft[key]);
    if (before !== after) {
      changes.push({ label, before: before || NOTHING, after: after || NOTHING });
    }
  }

  for (const [key, label] of LIST_FIELDS) {
    if (!sameShape(current[key], draft[key])) {
      changes.push({
        label,
        before: entries(current[key]?.length ?? 0),
        after: entries(draft[key]?.length ?? 0),
      });
    }
  }

  if (!sameShape(current.skills, draft.skills)) {
    changes.push({
      label: 'Skills',
      before: skillCount(current.skills?.length ?? 0),
      after: skillCount(draft.skills?.length ?? 0),
      merges: true,
    });
  }

  if (!sameShape(current.unmapped_skills, draft.unmapped_skills)) {
    changes.push({
      label: 'Other skills',
      before: skillCount(current.unmapped_skills?.length ?? 0),
      after: skillCount(draft.unmapped_skills?.length ?? 0),
    });
  }

  return changes;
}

/** A skill this CV introduced has no years on it, and the profile will not save without them. */
export function skillsNeedingYears(draft: ProfileDraft): string[] {
  return (draft.skills ?? [])
    .filter((skill) => skill.years_experience == null)
    .map((skill) => skill.name);
}

export function profileFromDraft(
  draft: ProfileDraft,
  years: Record<string, number>,
): CandidateProfile {
  const { skills, ...rest } = draft;
  if (!skills) return rest;

  return {
    ...rest,
    skills: skills.map((skill) => {
      const filled = skill.years_experience ?? years[skill.name];
      // Never defaulted to zero: blank and 0 are opposite answers, and only the candidate can
      // say which. Reaching this means the form and the draft disagreed about the skills.
      if (filled === undefined) throw new Error(`no years given for the skill "${skill.name}"`);
      return { name: skill.name, years_experience: filled };
    }),
  };
}
