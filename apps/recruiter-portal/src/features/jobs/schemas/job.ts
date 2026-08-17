import { z } from 'zod';
import {
  EMPLOYMENT_TYPE_LABELS,
  type EmploymentType,
  type NewJob,
  TRAVELLED_TO,
  WORK_MODE_LABELS,
  type WorkMode,
} from '../job';

const optionalLine = z.string().trim().max(200, 'Keep this to 200 characters or fewer.');

const employmentType = ['', ...Object.keys(EMPLOYMENT_TYPE_LABELS)] as ['', ...EmploymentType[]];
const workMode = ['', ...Object.keys(WORK_MODE_LABELS)] as ['', ...WorkMode[]];

export const jobFormSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, 'Enter a job title.')
      .max(200, 'Keep the title to 200 characters or fewer.'),
    description: z
      .string()
      .trim()
      .min(1, 'Enter a job description.')
      .max(5_000, 'Keep the description to 5,000 characters or fewer.'),
    locationKey: optionalLine,
    employmentType: z.enum(employmentType),
    workMode: z.enum(workMode),
    expiresAt: z
      .string()
      .refine((value) => value === '' || !Number.isNaN(new Date(value).getTime()), {
        message: 'Enter a valid date and time.',
      }),
  })
  .superRefine((values, ctx) => {
    const travelledTo = values.workMode !== '' && TRAVELLED_TO.includes(values.workMode);
    if (travelledTo && values.locationKey.trim() === '') {
      ctx.addIssue({
        code: 'custom',
        path: ['locationKey'],
        message:
          'On-site and hybrid work happens somewhere. Name the Location, or make the role remote.',
      });
    }
  });

export const WORK_MODE_BEFORE_PUBLISHING =
  'Say how much of this role happens where the team is before it goes live. A draft can wait.';

export type JobFormValues = z.infer<typeof jobFormSchema>;

export const EMPTY_JOB: JobFormValues = {
  title: '',
  description: '',
  locationKey: '',
  employmentType: '',
  workMode: '',
  expiresAt: '',
};

export const jobDraftSchema = z
  .object({
    title: z.string().catch(''),
    description: z.string().catch(''),
    locationKey: z.string().catch(''),
    employmentType: z.enum(employmentType).catch(''),
    workMode: z.enum(workMode).catch(''),
    expiresAt: z.string().catch(''),
  })
  .catch(EMPTY_JOB);

function optional(value: string): string | null {
  return value.trim() || null;
}

export function toNewJob(values: JobFormValues): NewJob {
  return {
    title: values.title.trim(),
    description: values.description.trim(),
    location_key: optional(values.locationKey),
    employment_type: values.employmentType || null,
    work_mode: values.workMode || null,
    expires_at: values.expiresAt ? new Date(values.expiresAt).toISOString() : null,
  };
}
