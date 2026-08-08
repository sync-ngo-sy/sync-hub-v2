import { z } from 'zod';
import { MAX_LANGUAGE_FILTERS, MIN_QUERY_LENGTH } from '../search';

const optionalLine = z.string().trim().max(200, 'Keep this to 200 characters or fewer.');

export const candidateSearchSchema = z.object({
  q: z
    .string()
    .trim()
    .min(MIN_QUERY_LENGTH, 'Say who you are looking for, in a couple of words at least.')
    .max(200, 'Keep this to 200 characters or fewer.'),
  location: optionalLine,
  languages: z
    .array(z.string().trim().max(8, 'Pick a language from the list.'))
    .max(MAX_LANGUAGE_FILTERS, `Name at most ${MAX_LANGUAGE_FILTERS} languages.`),
  keywords: optionalLine,
});

export type CandidateSearchValues = z.infer<typeof candidateSearchSchema>;
