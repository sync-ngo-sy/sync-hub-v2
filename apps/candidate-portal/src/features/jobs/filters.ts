import { z } from 'zod';
import { EMPLOYMENT_TYPE_LABELS, type EmploymentType } from './job';

/** The API refuses a longer `q` than a line, so the field never offers to send one. */
export const MAX_KEYWORDS = 200;

const employmentTypes = Object.keys(EMPLOYMENT_TYPE_LABELS) as [
  EmploymentType,
  ...EmploymentType[],
];

/** A blank is not a filter: `?q=` in the address bar is a reader who cleared the box, not a
 * search for nothing. */
const filled = z.string().trim().min(1).max(MAX_KEYWORDS).optional().catch(undefined);

/**
 * The address bar is where the filters live, so this is both the route's search schema and the
 * only definition of what a filtered Browse is. Every field catches rather than throws: a
 * hand-edited or truncated link is a filter the platform cannot honour, not a broken page — so
 * it drops that one filter and shows the rest.
 */
export const jobFiltersSchema = z.object({
  q: filled,
  location: filled,
  type: z.enum(employmentTypes).optional().catch(undefined),
});

export type JobFilters = z.infer<typeof jobFiltersSchema>;

/** A picker's answer read against the same set the address bar accepts, so the two cannot
 * disagree about what an employment type is — and a blank means the whole set, not a filter. */
export function asEmploymentType(chosen: string | null): EmploymentType | undefined {
  return jobFiltersSchema.shape.type.parse(chosen);
}

export const NO_FILTERS: JobFilters = {};

export function isFiltered(filters: JobFilters): boolean {
  return Boolean(filters.q || filters.location || filters.type);
}

/** The wire's names for the same three. `undefined` is dropped by the client, so an unset filter
 * is an absent parameter rather than an empty one the API would have to interpret. */
export function browseQuery(filters: JobFilters) {
  return { q: filters.q, location_key: filters.location, employment_type: filters.type };
}
