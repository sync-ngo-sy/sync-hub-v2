import { z } from 'zod';
import { MIN_QUERY_LENGTH } from '../search';

const optionalLine = z.string().trim().max(200, 'Keep this to 200 characters or fewer.');

export const candidateSearchSchema = z.object({
  q: z
    .string()
    .trim()
    .min(MIN_QUERY_LENGTH, 'Say who you are looking for, in a couple of words at least.')
    .max(200, 'Keep this to 200 characters or fewer.'),
  location: optionalLine,
  language: z.string().trim().max(8, 'Pick a language from the list.'),
  keywords: optionalLine,
});

export type CandidateSearchValues = z.infer<typeof candidateSearchSchema>;
