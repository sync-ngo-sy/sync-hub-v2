import type { components } from '@sync/api-client/schema';
import { z } from 'zod';

type CandidateProfile = components['schemas']['CandidateProfile'];

// Mirrors of the backend constraints (sync_core/profile.py, sync_api/text.py, payload.py). The
// server is the source of truth; these give the same answer instantly, in the field, before a PUT.
export const MAX_ENTRIES = 50;
const MAX_LINE = 200;
const MAX_PARAGRAPH = 5000;
const MAX_LINK = 2000;
const EARLIEST_YEAR = 1900;
const LATEST_YEAR = 2100;
const MAX_YEARS_EXPERIENCE = 999.9;

export const PROFICIENCIES = ['beginner', 'intermediate', 'advanced', 'fluent', 'native'] as const;

const line = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `Enter ${label}`)
    .max(MAX_LINE, `Keep ${label} under ${MAX_LINE} characters`);
const optionalLine = z.string().trim().max(MAX_LINE, `Keep this under ${MAX_LINE} characters`);
const optionalParagraph = z
  .string()
  .trim()
  .max(MAX_PARAGRAPH, `Keep this under ${MAX_PARAGRAPH} characters`);
const optionalLink = z.string().trim().max(MAX_LINK, `Keep this under ${MAX_LINK} characters`);
// A language code is 2–8 characters, but blank is allowed for the optional preferred language.
const optionalLanguageCode = z
  .string()
  .trim()
  .max(8, 'A language code is at most 8 characters')
  .refine((value) => value === '' || value.length >= 2, 'A language code is at least 2 characters');

const year = z
  .number()
  .int('Enter a whole year')
  .gte(EARLIEST_YEAR, `Year must be ${EARLIEST_YEAR} or later`)
  .lte(LATEST_YEAR, `Year must be ${LATEST_YEAR} or earlier`)
  .nullable();
const month = z
  .number()
  .int('Enter a whole month')
  .gte(1, 'Month is 1–12')
  .lte(12, 'Month is 1–12')
  .nullable();

type Issue = { path: (string | number)[]; message: string };

/** `(end_year, end_month) >= (start_year, start_month)`, comparable only when both years are known. */
function endBeforeStartIssues(range: {
  start_year: number | null;
  start_month: number | null;
  end_year: number | null;
  end_month: number | null;
}): Issue[] {
  if (range.start_year === null || range.end_year === null) return [];
  const start = range.start_year * 100 + (range.start_month ?? 1);
  const end = range.end_year * 100 + (range.end_month ?? 12);
  return end < start
    ? [{ path: ['end_year'], message: 'The end cannot come before the start' }]
    : [];
}

const experienceItem = z
  .object({
    job_title: line('a job title'),
    company_name: optionalLine,
    start_year: year,
    start_month: month,
    end_year: year,
    end_month: month,
    is_current: z.boolean(),
    description: optionalParagraph,
  })
  .superRefine((item, ctx) => {
    const issues = endBeforeStartIssues(item);
    if (item.is_current && (item.end_year !== null || item.end_month !== null)) {
      issues.push({ path: ['end_year'], message: 'A current job cannot have an end date' });
    }
    for (const issue of issues) ctx.addIssue({ code: 'custom', ...issue });
  });

const educationItem = z.object({
  institution: line('an institution'),
  degree: optionalLine,
  field_of_study: optionalLine,
  graduation_year: year,
  description: optionalParagraph,
});

const skillItem = z.object({
  name: line('a skill'),
  // Nullable so an added-but-unfilled skill can sit in the form; the top-level check makes it
  // required before a save. (A `.refine(v => v !== null)` here would narrow the output to a bare
  // `number`, splitting it from the nullable value the form actually holds.)
  years_experience: z
    .number({ error: 'Enter years of experience' })
    .gte(0, 'Years cannot be negative')
    .lte(MAX_YEARS_EXPERIENCE, `Years must be ${MAX_YEARS_EXPERIENCE} or fewer`)
    .nullable(),
});

const languageItem = z.object({
  code: z
    .string()
    .trim()
    .min(2, 'A language code is at least 2 characters')
    .max(8, 'A language code is at most 8 characters'),
  proficiency: z.enum(PROFICIENCIES),
});

const projectItem = z
  .object({
    name: line('a project name'),
    description: optionalParagraph,
    project_url: optionalLink,
    repository_url: optionalLink,
    start_year: year,
    start_month: month,
    end_year: year,
    end_month: month,
  })
  .superRefine((item, ctx) => {
    for (const issue of endBeforeStartIssues(item)) ctx.addIssue({ code: 'custom', ...issue });
  });

const unmappedSkillItem = z.object({ value: line('a skill') });

const section = <T extends z.ZodTypeAny>(item: T, singular: string) =>
  z.array(item).max(MAX_ENTRIES, `You can list at most ${MAX_ENTRIES} ${singular}`);

export const profileSchema = z
  .object({
    full_name: line('your full name'),
    phone: optionalLine,
    headline: optionalLine,
    summary: optionalParagraph,
    location: optionalLine,
    preferred_language_code: optionalLanguageCode,
    is_searchable: z.boolean(),
    experiences: section(experienceItem, 'jobs'),
    educations: section(educationItem, 'qualifications'),
    skills: section(skillItem, 'skills'),
    languages: section(languageItem, 'languages'),
    projects: section(projectItem, 'projects'),
    unmapped_skills: section(unmappedSkillItem, 'skills'),
  })
  .superRefine((profile, ctx) => {
    const issues: Issue[] = [
      ...repeatIssues(
        profile.skills.map((s) => s.name),
        'skills',
        'name',
      ),
      ...repeatIssues(
        profile.languages.map((l) => l.code),
        'languages',
        'code',
      ),
    ];
    profile.skills.forEach((skill, index) => {
      if (skill.years_experience === null) {
        issues.push({
          path: ['skills', index, 'years_experience'],
          message: 'Enter years of experience',
        });
      }
    });
    for (const issue of issues) ctx.addIssue({ code: 'custom', ...issue });
  });

/** One entry per skill/language, matching the backend's `_refuse_repeats`, flagged on the duplicate. */
function repeatIssues(values: string[], section: 'skills' | 'languages', field: string): Issue[] {
  const seen = new Set<string>();
  const issues: Issue[] = [];
  values.forEach((value, index) => {
    if (seen.has(value)) {
      issues.push({ path: [section, index, field], message: 'This entry is already listed' });
    } else {
      seen.add(value);
    }
  });
  return issues;
}

export type ProfileFormValues = z.infer<typeof profileSchema>;

/** Blank optional lines are "not set", never "set to nothing" — the `_blank_as_unset` rule. */
function blankToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/** The profile the server returned, shaped into the form's fully-controlled value tree. */
export function toFormValues(profile: CandidateProfile): ProfileFormValues {
  return {
    full_name: profile.full_name,
    phone: profile.phone ?? '',
    headline: profile.headline ?? '',
    summary: profile.summary ?? '',
    location: profile.location ?? '',
    preferred_language_code: profile.preferred_language_code ?? '',
    is_searchable: profile.is_searchable,
    experiences: (profile.experiences ?? []).map((e) => ({
      job_title: e.job_title,
      company_name: e.company_name ?? '',
      start_year: e.start_year ?? null,
      start_month: e.start_month ?? null,
      end_year: e.end_year ?? null,
      end_month: e.end_month ?? null,
      is_current: e.is_current,
      description: e.description ?? '',
    })),
    educations: (profile.educations ?? []).map((e) => ({
      institution: e.institution,
      degree: e.degree ?? '',
      field_of_study: e.field_of_study ?? '',
      graduation_year: e.graduation_year ?? null,
      description: e.description ?? '',
    })),
    skills: (profile.skills ?? []).map((s) => ({
      name: s.name,
      years_experience: s.years_experience,
    })),
    languages: (profile.languages ?? []).map((l) => ({ code: l.code, proficiency: l.proficiency })),
    projects: (profile.projects ?? []).map((p) => ({
      name: p.name,
      description: p.description ?? '',
      project_url: p.project_url ?? '',
      repository_url: p.repository_url ?? '',
      start_year: p.start_year ?? null,
      start_month: p.start_month ?? null,
      end_year: p.end_year ?? null,
      end_month: p.end_month ?? null,
    })),
    unmapped_skills: (profile.unmapped_skills ?? []).map((value) => ({ value })),
  };
}

/** The validated form, back into a whole-profile PUT body — blanks dropped, sections in order. */
export function toProfile(values: ProfileFormValues): CandidateProfile {
  return {
    full_name: values.full_name.trim(),
    phone: blankToNull(values.phone),
    headline: blankToNull(values.headline),
    summary: blankToNull(values.summary),
    location: blankToNull(values.location),
    preferred_language_code: blankToNull(values.preferred_language_code),
    is_searchable: values.is_searchable,
    experiences: values.experiences.map((e) => ({
      job_title: e.job_title.trim(),
      company_name: blankToNull(e.company_name),
      start_year: e.start_year,
      start_month: e.start_month,
      end_year: e.end_year,
      end_month: e.end_month,
      is_current: e.is_current,
      description: blankToNull(e.description),
    })),
    educations: values.educations.map((e) => ({
      institution: e.institution.trim(),
      degree: blankToNull(e.degree),
      field_of_study: blankToNull(e.field_of_study),
      graduation_year: e.graduation_year,
      description: blankToNull(e.description),
    })),
    skills: values.skills.map((s) => ({
      name: s.name.trim(),
      years_experience: s.years_experience ?? 0,
    })),
    languages: values.languages.map((l) => ({ code: l.code.trim(), proficiency: l.proficiency })),
    projects: values.projects.map((p) => ({
      name: p.name.trim(),
      description: blankToNull(p.description),
      project_url: blankToNull(p.project_url),
      repository_url: blankToNull(p.repository_url),
      start_year: p.start_year,
      start_month: p.start_month,
      end_year: p.end_year,
      end_month: p.end_month,
    })),
    unmapped_skills: values.unmapped_skills.map((s) => s.value.trim()),
  };
}
