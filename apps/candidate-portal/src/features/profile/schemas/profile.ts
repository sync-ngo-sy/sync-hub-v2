import type { components } from '@sync/api-client';
import { z } from 'zod';

type CandidateProfile = components['schemas']['CandidateProfile'];
type Proficiency = components['schemas']['LanguageProficiency'];

/** The bounds `sync_core.profile` and `sync_api.text` enforce, restated so a rejection can
 * happen in the field instead of a round trip away. */
export const MAX_ENTRIES = 50;
const MAX_LINE = 200;
const MAX_PARAGRAPH = 5000;
const MAX_LINK = 2000;
const EARLIEST_YEAR = 1900;
const LATEST_YEAR = 2100;
const MAX_YEARS_EXPERIENCE = 999.9;
const MIN_LANGUAGE_CODE = 2;
const MAX_LANGUAGE_CODE = 8;

/** Every proficiency the API has — the type makes sure of that — in the order the editor
 * offers them, and what to call each on screen. */
export const PROFICIENCY_LABELS: Record<Proficiency, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
  fluent: 'Fluent',
  native: 'Native',
};

const PROFICIENCIES = Object.keys(PROFICIENCY_LABELS) as [Proficiency, ...Proficiency[]];

const line = (missing: string) =>
  z.string().trim().min(1, missing).max(MAX_LINE, `Use ${MAX_LINE} characters or fewer.`);

/** Blank means "not set", never "set to nothing" — the API's `_blank_as_unset`. */
const blankAsUnset = (raw: string) => (raw.trim() === '' ? null : raw.trim());

const optionalText = (limit: number) =>
  z.string().trim().max(limit, `Use ${limit} characters or fewer.`).transform(blankAsUnset);

const optionalLine = optionalText(MAX_LINE);
const optionalParagraph = optionalText(MAX_PARAGRAPH);
const optionalLink = optionalText(MAX_LINK);

const optionalNumber = (low: number, high: number, message: string) =>
  z
    .string()
    .trim()
    .refine(
      (raw) => raw === '' || (/^\d+$/.test(raw) && Number(raw) >= low && Number(raw) <= high),
      message,
    )
    .transform((raw) => (raw === '' ? null : Number(raw)));

const optionalYear = optionalNumber(
  EARLIEST_YEAR,
  LATEST_YEAR,
  `Enter a year between ${EARLIEST_YEAR} and ${LATEST_YEAR}.`,
);
const optionalMonth = optionalNumber(1, 12, 'Enter a month between 1 and 12.');

const LANGUAGE_CODE_MESSAGE = `A language code is ${MIN_LANGUAGE_CODE} to ${MAX_LANGUAGE_CODE} characters.`;
const isLanguageCode = (raw: string) =>
  raw.length >= MIN_LANGUAGE_CODE && raw.length <= MAX_LANGUAGE_CODE;

const languageCode = z
  .string()
  .trim()
  .min(1, 'Choose a language.')
  .refine(isLanguageCode, LANGUAGE_CODE_MESSAGE);

const optionalLanguageCode = z
  .string()
  .trim()
  .refine((raw) => raw === '' || isLanguageCode(raw), LANGUAGE_CODE_MESSAGE)
  .transform(blankAsUnset);

const yearsOfExperience = z
  .string()
  .trim()
  .min(1, 'Enter years of experience.')
  .refine((raw) => /^\d*\.?\d+$/.test(raw), 'Enter years as a number.')
  // `candidate_skills.years_experience` is `numeric(4,1)`, which would round a second decimal
  // place away without saying so.
  .refine((raw) => /^\d*(\.\d)?$/.test(raw), 'Years go to one decimal place, like 3 or 3.5.')
  .refine(
    (raw) => Number(raw) <= MAX_YEARS_EXPERIENCE,
    `Enter ${MAX_YEARS_EXPERIENCE} years or fewer.`,
  )
  .transform(Number);

const period = {
  start_year: optionalYear,
  start_month: optionalMonth,
  end_year: optionalYear,
  end_month: optionalMonth,
};

interface Period {
  start_year: number | null;
  start_month: number | null;
  end_year: number | null;
  end_month: number | null;
}

/** Where a complaint about an end date belongs: on whichever half of it was filled in. */
const endOf = (entry: Period) => (entry.end_year !== null ? 'end_year' : 'end_month');

/** The `*_ordered` CHECK, restated: comparable only once both years are known. */
function refuseAnEndBeforeItsStart(entry: Period, ctx: z.RefinementCtx): void {
  if (entry.start_year === null || entry.end_year === null) return;
  const start = entry.start_year * 100 + (entry.start_month ?? 1);
  const end = entry.end_year * 100 + (entry.end_month ?? 12);
  if (end < start) {
    ctx.addIssue({
      code: 'custom',
      path: [endOf(entry)],
      message: 'The end cannot come before the start.',
    });
  }
}

const experience = z
  .object({
    job_title: line('Enter the job title.'),
    company_name: optionalLine,
    ...period,
    is_current: z.boolean(),
    description: optionalParagraph,
  })
  .superRefine((entry, ctx) => {
    // The `cexp_current_has_no_end` CHECK, restated.
    if (entry.is_current && (entry.end_year !== null || entry.end_month !== null)) {
      ctx.addIssue({
        code: 'custom',
        path: [endOf(entry)],
        message: 'A current job has no end date.',
      });
      return;
    }
    refuseAnEndBeforeItsStart(entry, ctx);
  });

const education = z.object({
  institution: line('Enter the institution.'),
  degree: optionalLine,
  field_of_study: optionalLine,
  graduation_year: optionalYear,
  description: optionalParagraph,
});

const skill = z.object({
  name: line('Choose a skill.'),
  years_experience: yearsOfExperience,
});

const language = z.object({
  code: languageCode,
  proficiency: z.enum(PROFICIENCIES),
});

const project = z
  .object({
    name: line('Enter the project name.'),
    description: optionalParagraph,
    project_url: optionalLink,
    repository_url: optionalLink,
    ...period,
  })
  .superRefine(refuseAnEndBeforeItsStart);

const unmappedSkill = z.object({ value: line('Enter the skill.') });

const section = <Entry extends z.ZodType>(entry: Entry, plural: string) =>
  z.array(entry).max(MAX_ENTRIES, `List at most ${MAX_ENTRIES} ${plural}.`);

/** One entry per skill and per language, as `_refuse_repeats` does it — flagged on the repeat,
 * so the entry the candidate meant to keep is left alone. */
function refuseRepeats(
  keys: string[],
  ctx: z.RefinementCtx,
  path: (index: number) => (string | number)[],
  message: string,
): void {
  const seen = new Set<string>();
  keys.forEach((key, index) => {
    if (seen.has(key)) ctx.addIssue({ code: 'custom', path: path(index), message });
    else seen.add(key);
  });
}

export const profileSchema = z
  .object({
    full_name: line('Enter your name.'),
    phone: optionalLine,
    headline: optionalLine,
    summary: optionalParagraph,
    location_key: optionalLine,
    preferred_language_code: optionalLanguageCode,
    is_searchable: z.boolean(),
    experiences: section(experience, 'jobs'),
    educations: section(education, 'qualifications'),
    skills: section(skill, 'skills'),
    languages: section(language, 'languages'),
    projects: section(project, 'projects'),
    unmapped_skills: section(unmappedSkill, 'skills'),
  })
  .superRefine((profile, ctx) => {
    refuseRepeats(
      profile.skills.map((entry) => entry.name),
      ctx,
      (index) => ['skills', index, 'name'],
      'This skill is already listed.',
    );
    refuseRepeats(
      profile.languages.map((entry) => entry.code),
      ctx,
      (index) => ['languages', index, 'code'],
      'This language is already listed.',
    );
    // The API deduplicates these case-insensitively instead of refusing them, which would take
    // an entry off the page without saying so.
    refuseRepeats(
      profile.unmapped_skills.map((entry) => entry.value.toLowerCase()),
      ctx,
      (index) => ['unmapped_skills', index, 'value'],
      'This skill is already listed.',
    );
  })
  .transform(
    (profile): CandidateProfile => ({
      ...profile,
      unmapped_skills: profile.unmapped_skills.map((entry) => entry.value),
    }),
  );

export type ProfileFormValues = z.input<typeof profileSchema>;

/** The validated form as a whole-profile `PUT` body. Only ever called with values the resolver
 * has already accepted, which is why it can parse rather than re-derive. */
export function toProfile(values: ProfileFormValues): CandidateProfile {
  return profileSchema.parse(values);
}

type Entry<Name extends keyof ProfileFormValues> = ProfileFormValues[Name] extends (infer Item)[]
  ? Item
  : never;

export const BLANK_EXPERIENCE: Entry<'experiences'> = {
  job_title: '',
  company_name: '',
  start_year: '',
  start_month: '',
  end_year: '',
  end_month: '',
  is_current: false,
  description: '',
};

export const BLANK_EDUCATION: Entry<'educations'> = {
  institution: '',
  degree: '',
  field_of_study: '',
  graduation_year: '',
  description: '',
};

export const BLANK_SKILL: Entry<'skills'> = { name: '', years_experience: '' };

export const BLANK_LANGUAGE: Entry<'languages'> = { code: '', proficiency: 'intermediate' };

export const BLANK_PROJECT: Entry<'projects'> = {
  name: '',
  description: '',
  project_url: '',
  repository_url: '',
  start_year: '',
  start_month: '',
  end_year: '',
  end_month: '',
};

export const BLANK_UNMAPPED_SKILL: Entry<'unmapped_skills'> = { value: '' };

/** An absent value is an empty field, whatever it was on the wire. */
const orEmpty = (value: string | number | null | undefined) =>
  value === null || value === undefined ? '' : String(value);

/** The profile the API answered with, as the fully-controlled value tree the form edits. */
export function toFormValues(profile: CandidateProfile): ProfileFormValues {
  return {
    full_name: profile.full_name,
    phone: orEmpty(profile.phone),
    headline: orEmpty(profile.headline),
    summary: orEmpty(profile.summary),
    location_key: orEmpty(profile.location_key),
    preferred_language_code: orEmpty(profile.preferred_language_code),
    is_searchable: profile.is_searchable,
    experiences: (profile.experiences ?? []).map((entry) => ({
      job_title: entry.job_title,
      company_name: orEmpty(entry.company_name),
      start_year: orEmpty(entry.start_year),
      start_month: orEmpty(entry.start_month),
      end_year: orEmpty(entry.end_year),
      end_month: orEmpty(entry.end_month),
      is_current: entry.is_current,
      description: orEmpty(entry.description),
    })),
    educations: (profile.educations ?? []).map((entry) => ({
      institution: entry.institution,
      degree: orEmpty(entry.degree),
      field_of_study: orEmpty(entry.field_of_study),
      graduation_year: orEmpty(entry.graduation_year),
      description: orEmpty(entry.description),
    })),
    skills: (profile.skills ?? []).map((entry) => ({
      name: entry.name,
      years_experience: orEmpty(entry.years_experience),
    })),
    languages: (profile.languages ?? []).map((entry) => ({
      code: entry.code,
      proficiency: entry.proficiency,
    })),
    projects: (profile.projects ?? []).map((entry) => ({
      name: entry.name,
      description: orEmpty(entry.description),
      project_url: orEmpty(entry.project_url),
      repository_url: orEmpty(entry.repository_url),
      start_year: orEmpty(entry.start_year),
      start_month: orEmpty(entry.start_month),
      end_year: orEmpty(entry.end_year),
      end_month: orEmpty(entry.end_month),
    })),
    unmapped_skills: (profile.unmapped_skills ?? []).map((value) => ({ value })),
  };
}
