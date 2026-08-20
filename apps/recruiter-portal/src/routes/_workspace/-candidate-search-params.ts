import { z } from 'zod';
import { candidatesReading } from '@/features/candidates/reading';

export const candidateSearchParams = candidatesReading;

export const candidateRecordSearchParams = candidatesReading.extend({
  from: z.string().optional().catch(undefined),
});
