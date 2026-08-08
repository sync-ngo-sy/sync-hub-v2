import { z } from 'zod';
import {
  MAX_EXPERIENCE_FILTER,
  MAX_LANGUAGE_FILTERS,
  MAX_SKILL_FILTERS,
  MIN_QUERY_LENGTH,
  PROFICIENCY_ORDER,
} from '../search';

const optionalLine = z.string().trim().max(200, 'Keep this to 200 characters or fewer.');

const spokenLanguage = z.object({
  code: z.string().trim().max(8, 'Pick a language from the list.'),
  level: z.union([z.enum(PROFICIENCY_ORDER), z.literal('')]),
});

const years = z
  .string()
  .trim()
  .refine((written) => written === '' || /^\d+$/.test(written), 'Whole years only.')
  .refine(
    (written) => written === '' || Number(written) <= MAX_EXPERIENCE_FILTER,
    `Nobody has worked more than ${MAX_EXPERIENCE_FILTER} years.`,
  );

const shared = {
  location: optionalLine,
  languages: z
    .array(spokenLanguage)
    .max(MAX_LANGUAGE_FILTERS, `Name at most ${MAX_LANGUAGE_FILTERS} languages.`),
  skills: z.array(z.string()).max(MAX_SKILL_FILTERS, `Name at most ${MAX_SKILL_FILTERS} skills.`),
  role: optionalLine,
  experience: years,
  keywords: optionalLine,
};

export const candidateSearchSchema = z.object({
  ...shared,
  q: z
    .string()
    .trim()
    .min(MIN_QUERY_LENGTH, 'Say who you are looking for, in a couple of words at least.')
    .max(200, 'Keep this to 200 characters or fewer.'),
});

/** The directory is asked with filters alone, so there are no words here to be too few of. */
export const candidateFilterSchema = z.object({ ...shared, q: z.string() });

export type CandidateSearchValues = z.infer<typeof candidateSearchSchema>;
