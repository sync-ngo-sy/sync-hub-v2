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

export function holdsHireClaims(claims: HireClaim[], asked?: HireConfirmation[]) {
  return [
    http.get(HIRE_CLAIMS_PATH, ({ query, response }) => {
      const confirmation = confirmationAsked(query.get('confirmation'));
      asked?.push(confirmation);
      return response(200).json({
        items: claims.filter((claim) => claim.confirmation === confirmation),
        next_cursor: null,
        counts: counted(claims),
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
      });
    }),
  ];
}

export function failsToListHireClaims(problem: Problem) {
  return [http.get(HIRE_CLAIMS_PATH, ({ response }) => response(500).json(problem))];
}
