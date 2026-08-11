import type { components } from '@sync/api-client';

export type Job = components['schemas']['PublicJob'];

export type JobSummary = components['schemas']['PublicJobSummary'];

type Skill = components['schemas']['JobSkillRequirement'];
type Language = components['schemas']['JobLanguageRequirement'];
type Proficiency = components['schemas']['LanguageProficiency'];
type Question = components['schemas']['PublicJobQuestion'];
export type EmploymentType = components['schemas']['EmploymentType'];
type WorkMode = components['schemas']['WorkMode'];

export const NOTHING_PUBLISHED =
  'No roles are open right now. New ones appear here the moment an employer publishes them.';

export const NOTHING_MATCHES =
  'No open roles match these filters. Widen one of them, or clear them all, to see more.';

export const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  full_time: 'Full time',
  part_time: 'Part time',
  contract: 'Contract',
  temporary: 'Temporary',
  internship: 'Internship',
  volunteer: 'Volunteer',
};

const WORK_MODE_LABELS: Record<WorkMode, string> = {
  onsite: 'On-site',
  hybrid: 'Hybrid',
  remote: 'Remote',
};

export function employmentTypeLabel(type: EmploymentType | null | undefined): string | null {
  return type ? EMPLOYMENT_TYPE_LABELS[type] : null;
}

export function workModeLabel(mode: WorkMode | null | undefined): string | null {
  return mode ? WORK_MODE_LABELS[mode] : null;
}

export function jobMeta(job: Job | JobSummary): string {
  return [
    job.tenant.name,
    job.location_name,
    workModeLabel(job.work_mode),
    employmentTypeLabel(job.employment_type),
  ]
    .filter(Boolean)
    .join(' · ');
}

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

export function skillDemand(skill: Skill): string {
  const importance = IMPORTANCE[skill.importance];
  const years = yearsAsked(skill.minimum_years);
  return years === null ? importance : `${importance} · ${years}+ years`;
}

const ANSWER_SHAPE: Record<components['schemas']['ApplicationQuestionType'], string> = {
  yes_no: 'Yes or no',
  short_text: 'Short answer',
};

export function questionShape(question: Question): string {
  const shape = ANSWER_SHAPE[question.question_type];
  return `${shape} · ${question.is_required ? 'Required' : 'Optional'}`;
}

const LANGUAGE_NAMES = new Intl.DisplayNames('en', { type: 'language' });

export function languageName(code: string): string {
  try {
    return LANGUAGE_NAMES.of(code) ?? code;
  } catch {
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

export function proficiencyLabel(language: Language): string {
  const level = PROFICIENCY[language.minimum_proficiency];
  return language.minimum_proficiency === 'native' ? level : `${level} or better`;
}
