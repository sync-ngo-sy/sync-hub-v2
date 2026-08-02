import { z } from 'zod';
import { EMPLOYMENT_TYPE_LABELS, type EmploymentType } from './job';

export const MAX_KEYWORD_LENGTH = 200;

const employmentTypes = Object.keys(EMPLOYMENT_TYPE_LABELS) as [
  EmploymentType,
  ...EmploymentType[],
];

const filled = z.string().trim().min(1);

const keyword = filled.max(MAX_KEYWORD_LENGTH);

export const jobFiltersSchema = z.object({
  q: keyword.optional().catch(undefined),
  location: filled.optional().catch(undefined),
  type: z.enum(employmentTypes).optional().catch(undefined),
});

export type JobFilters = z.infer<typeof jobFiltersSchema>;

export function asEmploymentType(chosen: string | null): EmploymentType | undefined {
  return jobFiltersSchema.shape.type.parse(chosen);
}

export const NO_FILTERS: JobFilters = {};

export function isFiltered(filters: JobFilters): boolean {
  return Boolean(filters.q || filters.location || filters.type);
}

export function browseQuery(filters: JobFilters) {
  return { q: filters.q, location_key: filters.location, employment_type: filters.type };
}
