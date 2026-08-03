import type { components } from '@sync/api-client';
import { http } from '@sync/api-client/testing';
import type { NewTrackedLink, TrackedLink, TrackedLinkChanges } from '../tracked-link';

type Problem = components['schemas']['ProblemDetail'];

const LIST = '/v1/tenants/me/jobs/{job_id}/links';
const ONE = '/v1/tenants/me/jobs/{job_id}/links/{link_id}';

export function listsTrackedLinks(items: TrackedLink[]) {
  return [http.get(LIST, ({ response }) => response(200).json(items))];
}

export function failsToListTrackedLinks(problem: Problem) {
  return [http.get(LIST, ({ response }) => response(500).json(problem))];
}

export function holdsTrackedLinks(items: TrackedLink[]) {
  let arrive: () => void = () => {};
  const held = new Promise<void>((resolve) => {
    arrive = resolve;
  });
  return {
    arrive: () => arrive(),
    handlers: [
      http.get(LIST, async ({ response }) => {
        await held;
        return response(200).json(items);
      }),
    ],
  };
}

export function refusesTrackedLinkMint(problem: Problem) {
  return [http.post(LIST, ({ response }) => response(409).json(problem))];
}

export function refusesTrackedLinkChange(problem: Problem) {
  return [http.patch(ONE, ({ response }) => response(409).json(problem))];
}

export function managesTrackedLinks(initial: TrackedLink[], minted?: Partial<TrackedLink>) {
  let links = initial;

  return {
    get links() {
      return links;
    },
    handlers: [
      http.get(LIST, ({ response }) => response(200).json(links)),
      http.post(LIST, async ({ request, response }) => {
        const body = (await request.json()) as NewTrackedLink;
        const link: TrackedLink = {
          id: `00000000-0000-4000-8000-00000000029${links.length}`,
          name: body.name,
          token: 'MintedTok3n',
          is_active: true,
          expires_at: body.expires_at ?? null,
          created_at: '2026-08-03T09:00:00Z',
          view_count: 0,
          ...minted,
        };
        links = [...links, link];
        return response(201).json(link);
      }),
      http.patch(ONE, async ({ params, request, response }) => {
        const changes = (await request.json()) as TrackedLinkChanges;
        const current = links.find((link) => link.id === params.link_id);
        if (!current) {
          return response(404).json({
            type: 'urn:sync:problem:tracked-link-not-found',
            title: 'Not found',
            status: 404,
            detail: 'No link of this job has that id.',
          });
        }
        const changed: TrackedLink = {
          ...current,
          ...(changes.name === undefined || changes.name === null ? {} : { name: changes.name }),
          ...(changes.is_active === undefined || changes.is_active === null
            ? {}
            : { is_active: changes.is_active }),
        };
        links = links.map((link) => (link.id === changed.id ? changed : link));
        return response(200).json(changed);
      }),
    ],
  };
}
