import { z } from 'zod';
import { MAX_LANGUAGE_FILTERS, MIN_QUERY_LENGTH, PROFICIENCY_ORDER } from '../search';

const optionalLine = z.string().trim().max(200, 'Keep this to 200 characters or fewer.');

const spokenLanguage = z.object({
  code: z.string().trim().max(8, 'Pick a language from the list.'),
  level: z.union([z.enum(PROFICIENCY_ORDER), z.literal('')]),
});

export const candidateSearchSchema = z.object({
  q: z
    .string()
    .trim()
    .min(MIN_QUERY_LENGTH, 'Say who you are looking for, in a couple of words at least.')
    .max(200, 'Keep this to 200 characters or fewer.'),
  location: optionalLine,
  languages: z
    .array(spokenLanguage)
    .max(MAX_LANGUAGE_FILTERS, `Name at most ${MAX_LANGUAGE_FILTERS} languages.`),
  keywords: optionalLine,
});

export type CandidateSearchValues = z.infer<typeof candidateSearchSchema>;
