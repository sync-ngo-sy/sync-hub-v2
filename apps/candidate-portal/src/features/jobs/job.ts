import type { components } from '@sync/api-client';

/** A published Job as a visitor reads it, whole. */
export type Job = components['schemas']['PublicJob'];

/** The same Job as a list renders it — no description, criteria or questions. */
export type JobSummary = components['schemas']['PublicJobSummary'];

type Skill = components['schemas']['JobSkillRequirement'];
type Language = components['schemas']['JobLanguageRequirement'];
type Proficiency = components['schemas']['LanguageProficiency'];
type Question = components['schemas']['PublicJobQuestion'];

/** The sentence every list and header shares when nothing is published. */
export const NOTHING_PUBLISHED =
  'No roles are open right now. New ones appear here the moment an employer publishes them.';

/** The employer first, then whichever of place and shape the Job actually carries. */
export function jobMeta(job: Job | JobSummary): string {
  return [job.tenant.name, job.location, job.employment_type].filter(Boolean).join(' · ');
}

/**
 * A depth the Job actually asks for, or nothing. The API allows zero years, which asks for no
 * experience at all — printing "0+ years" would dress that up as a requirement.
 */
export function yearsAsked(years: number | null | undefined): number | null {
  return years !== null && years !== undefined && years > 0 ? years : null;
}

export function experienceLabel(years: number): string {
  return `${years}+ years total experience`;
}

const IMPORTANCE: Record<components['schemas']['SkillImportance'], string> = {
  required: 'Required',
  preferred: 'Preferred',
  optional: 'Optional',
};

/** How much the skill matters, and how much of it is wanted — the depth only when it is asked for. */
export function skillDemand(skill: Skill): string {
  const importance = IMPORTANCE[skill.importance];
  const years = yearsAsked(skill.minimum_years);
  return years === null ? importance : `${importance} · ${years}+ years`;
}

const ANSWER_SHAPE: Record<components['schemas']['ApplicationQuestionType'], string> = {
  yes_no: 'Yes or no',
  short_text: 'Short answer',
};

/** What answering asks for, so a reader knows a yes/no from a paragraph before they start. */
export function questionShape(question: Question): string {
  const shape = ANSWER_SHAPE[question.question_type];
  return `${shape} · ${question.is_required ? 'Required' : 'Optional'}`;
}

// Pinned to English rather than the reader's locale: the product is English-only (ADR-0007), so
// a French browser would otherwise print "anglais" in the middle of an English sentence.
const LANGUAGE_NAMES = new Intl.DisplayNames('en', { type: 'language' });

export function languageName(code: string): string {
  try {
    return LANGUAGE_NAMES.of(code) ?? code;
  } catch {
    // A code the platform holds but Intl does not recognise is still worth showing as-is.
    return code;
  }
}

const PROFICIENCY: Record<Proficiency, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
  fluent: 'Fluent',
  native: 'Native',
};

/** A floor, so every level reads as one — except the top, where there is nothing better. */
export function proficiencyLabel(language: Language): string {
  const level = PROFICIENCY[language.minimum_proficiency];
  return language.minimum_proficiency === 'native' ? level : `${level} or better`;
}
