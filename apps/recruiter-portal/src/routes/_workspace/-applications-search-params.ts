import { z } from 'zod';
import { applicationsReading } from '@/features/applications/reading';

export const applicationsSearchParams = applicationsReading;

export const applicationReviewSearchParams = applicationsReading.extend({
  from: z.string().optional().catch(undefined),
});
