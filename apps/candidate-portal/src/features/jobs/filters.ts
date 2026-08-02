import { z } from 'zod';
import { EMPLOYMENT_TYPE_LABELS, type EmploymentType } from './job';

/** Characters, not words: the API refuses a `q` longer than a line (`MAX_LINE_LENGTH` in
 * `sync_core.profile`), so the field never offers to send one. */
export const MAX_KEYWORD_LENGTH = 200;

const employmentTypes = Object.keys(EMPLOYMENT_TYPE_LABELS) as [
  EmploymentType,
  ...EmploymentType[],
];

/** A blank is not a filter: `?q=` in the address bar is a reader who cleared the box, not a
 * search for nothing. */
const filled = z.string().trim().min(1);

/** Only the keyword carries the API's length cap. A Location is a taxonomy key, and one the
 * taxonomy lacks answers with an empty list rather than a refusal, so its length is not ours to
 * police. */
const keyword = filled.max(MAX_KEYWORD_LENGTH);

/**
 * The address bar is where the filters live, so this is both the route's search schema and the
 * only definition of what a filtered Browse is. Every field catches rather than throws: a
 * hand-edited or truncated link is a filter the platform cannot honour, not a broken page — so
 * it drops that one filter and shows the rest.
 */
export const jobFiltersSchema = z.object({
  q: keyword.optional().catch(undefined),
  location: filled.optional().catch(undefined),
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
