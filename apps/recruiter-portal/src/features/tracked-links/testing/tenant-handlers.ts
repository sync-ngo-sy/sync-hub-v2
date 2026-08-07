import type { components } from '@sync/api-client';
import { http } from '@sync/api-client/testing';

type Problem = components['schemas']['ProblemDetail'];
type TenantTrackedLink = components['schemas']['TenantTrackedLink'];

const PATH = '/v1/tenants/me/tracked-links';

function narrow(links: TenantTrackedLink[], q: string | null, active: string | null) {
  const asked = (q ?? '').toLowerCase();
  return links
    .filter((link) => link.name.toLowerCase().includes(asked))
    .filter((link) => active === null || link.is_active === (active === 'true'));
}

export function listsTenantTrackedLinks(links: TenantTrackedLink[]) {
  return [
    http.get(PATH, ({ query, response }) =>
      response(200).json({
        items: narrow(links, query.get('q'), query.get('is_active')),
        next_cursor: null,
      }),
    ),
  ];
}

export function pagesTenantTrackedLinks(pages: TenantTrackedLink[][]) {
  return [
    http.get(PATH, ({ query, response }) => {
      const cursor = query.get('cursor');
      const index = cursor === null ? 0 : Number(cursor);
      return response(200).json({
        items: pages[index] ?? [],
        next_cursor: index + 1 < pages.length ? String(index + 1) : null,
      });
    }),
  ];
}

export function failsToListTenantTrackedLinks(problem: Problem) {
  return [http.get(PATH, ({ response }) => response(500).json(problem))];
}

export function recordsSearches(links: TenantTrackedLink[], asked: (string | null)[]) {
  return [
    http.get(PATH, ({ query, response }) => {
      asked.push(query.get('q'));
      return response(200).json({
        items: narrow(links, query.get('q'), query.get('is_active')),
        next_cursor: null,
      });
    }),
  ];
}
