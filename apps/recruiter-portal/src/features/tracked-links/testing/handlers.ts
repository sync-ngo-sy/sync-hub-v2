import type { components } from '@sync/api-client';
import { http } from '@sync/api-client/testing';
import { holding } from '@/testing/holding';
import { TRACKED_LINK_PATH, TRACKED_LINKS_PATH } from '../hooks/use-tracked-links';
import type {
  NewTrackedLink,
  TrackedLink,
  TrackedLinkChanges,
  TrackedLinkReport,
} from '../tracked-link';

type Problem = components['schemas']['ProblemDetail'];

function report(items: TrackedLink[], directViewCount = 0): TrackedLinkReport {
  return {
    items,
    direct_view_count: directViewCount,
    view_count: items.reduce((total, link) => total + link.view_count, directViewCount),
  };
}

export function listsTrackedLinks(items: TrackedLink[], directViewCount = 0) {
  return [
    http.get(TRACKED_LINKS_PATH, ({ response }) =>
      response(200).json(report(items, directViewCount)),
    ),
  ];
}

export function failsToListTrackedLinks(problem: Problem) {
  return [http.get(TRACKED_LINKS_PATH, ({ response }) => response(500).json(problem))];
}

export function holdsTrackedLinks(items: TrackedLink[]) {
  const gate = holding();
  return {
    arrive: gate.arrive,
    handlers: [
      http.get(TRACKED_LINKS_PATH, async ({ response }) => {
        await gate.held;
        return response(200).json(report(items));
      }),
    ],
  };
}

export function refusesTrackedLinkMint(problem: Problem) {
  return [http.post(TRACKED_LINKS_PATH, ({ response }) => response(409).json(problem))];
}

export function refusesTrackedLinkChange(problem: Problem) {
  return [http.patch(TRACKED_LINK_PATH, ({ response }) => response(409).json(problem))];
}

export function holdsTrackedLinkChange(result: TrackedLink) {
  const gate = holding();
  const asked: string[] = [];
  return {
    arrive: gate.arrive,
    asked,
    handlers: [
      http.patch(TRACKED_LINK_PATH, async ({ params, response }) => {
        asked.push(String(params.link_id));
        await gate.held;
        return response(200).json(result);
      }),
    ],
  };
}

export function managesTrackedLinks(initial: TrackedLink[]) {
  let links = initial;

  return {
    get links() {
      return links;
    },
    handlers: [
      http.get(TRACKED_LINKS_PATH, ({ response }) => response(200).json(report(links))),
      http.post(TRACKED_LINKS_PATH, async ({ request, response }) => {
        const body = (await request.json()) as NewTrackedLink;
        const link: TrackedLink = {
          id: `00000000-0000-4000-8000-00000000029${links.length}`,
          name: body.name,
          token: 'MintedTok3n',
          is_active: true,
          expires_at: null,
          created_at: '2026-08-03T09:00:00Z',
          view_count: 0,
          application_count: 0,
          conversion_rate: null,
        };
        links = [...links, link];
        return response(201).json(link);
      }),
      http.patch(TRACKED_LINK_PATH, async ({ params, request, response }) => {
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
