import type { components } from '@sync/api-client';
import { http } from '@sync/api-client/testing';
import { CLAIM_TABS, DEFAULT_TAB, type HireClaim, type HireConfirmation } from '../placement';
import { HIRE_CLAIMS_PATH } from '../reread';

type Problem = components['schemas']['ProblemDetail'];

function confirmationAsked(asked: string | null | undefined): HireConfirmation {
  return CLAIM_TABS.find((tab) => tab === asked) ?? DEFAULT_TAB;
}

function counted(claims: HireClaim[]) {
  return CLAIM_TABS.map((tab) => ({
    confirmation: tab,
    count: claims.filter((claim) => claim.confirmation === tab).length,
  }));
}

function jobsToFilterBy(claims: HireClaim[], read: { id: string; title: string } | undefined) {
  const named = new Map(claims.map((claim) => [claim.job.id, claim.job.title]));
  if (read !== undefined && !named.has(read.id)) named.set(read.id, read.title);
  return [...named]
    .map(([id, title]) => ({ id, title }))
    .sort((one, other) => one.title.localeCompare(other.title));
}

export interface HireClaimsAsked {
  confirmation: HireConfirmation;
  job?: string;
}

/** A Job the Tenant has but nobody was claimed on, which the answer names while it is the one
 * being read — as the API does, so a Job's Placements count of zero opens a filter that can say
 * which Job it is showing. */
export interface QuietJob {
  id: string;
  title: string;
}

export function holdsHireClaims(claims: HireClaim[], asked?: HireClaimsAsked[], quiet?: QuietJob) {
  return [
    http.get(HIRE_CLAIMS_PATH, ({ query, response }) => {
      const confirmation = confirmationAsked(query.get('confirmation'));
      const job = query.get('job_id') ?? undefined;
      asked?.push(job === undefined ? { confirmation } : { confirmation, job });
      const onTheJob = claims.filter((claim) => job === undefined || claim.job.id === job);
      return response(200).json({
        items: onTheJob.filter((claim) => claim.confirmation === confirmation),
        next_cursor: null,
        counts: counted(onTheJob),
        jobs: jobsToFilterBy(claims, quiet?.id === job ? quiet : undefined),
      });
    }),
  ];
}

export function pagesHireClaims(pages: HireClaim[][]) {
  return [
    http.get(HIRE_CLAIMS_PATH, ({ query, response }) => {
      const cursor = query.get('cursor');
      const index = cursor === null ? 0 : Number(cursor);
      return response(200).json({
        items: pages[index] ?? [],
        next_cursor: index + 1 < pages.length ? String(index + 1) : null,
        counts: counted(pages.flat()),
        jobs: jobsToFilterBy(pages.flat(), undefined),
      });
    }),
  ];
}

export function failsToListHireClaims(problem: Problem) {
  return [http.get(HIRE_CLAIMS_PATH, ({ response }) => response(500).json(problem))];
}
