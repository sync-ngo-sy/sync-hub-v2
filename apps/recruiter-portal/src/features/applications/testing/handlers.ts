import type { components } from '@sync/api-client';
import { http } from '@sync/api-client/testing';
import type { ApplicationSummary, PipelineStatus } from '../application';
import type { ApplicationReview } from '../review';

type Problem = components['schemas']['ProblemDetail'];
type StatusChange = components['schemas']['ApplicationStatusChange'];

const PATH = '/v1/tenants/me/jobs/{job_id}/applications';
const REVIEW_PATH = '/v1/tenants/me/applications/{application_id}';

const NO_SUCH_APPLICATION: Problem = {
  type: 'urn:sync:problem:not-found',
  title: 'Not Found',
  status: 404,
  detail: 'This tenant has no application with that id.',
};

export interface AskedFor {
  status: string | null;
  qualification_status: string | null;
}

export function listsJobApplications(items: ApplicationSummary[], asked?: AskedFor[]) {
  return [
    http.get(PATH, ({ query, response }) => {
      const status = query.get('status');
      const qualification = query.get('qualification_status');
      asked?.push({ status, qualification_status: qualification });
      return response(200).json({
        items: items
          .filter((item) => (status ? item.status === status : true))
          .filter((item) => (qualification ? item.qualification_status === qualification : true)),
        next_cursor: null,
      });
    }),
  ];
}

export function pagesJobApplications(pages: ApplicationSummary[][]) {
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

export function failsToListJobApplications(problem: Problem) {
  return [http.get(PATH, ({ response }) => response(500).json(problem))];
}

export function getsApplication(review: ApplicationReview) {
  return [
    http.get(REVIEW_PATH, ({ params, response }) =>
      params.application_id === review.id
        ? response(200).json(review)
        : response(404).json(NO_SUCH_APPLICATION),
    ),
  ];
}

export function failsToGetApplication(problem: Problem) {
  return [http.get(REVIEW_PATH, ({ response }) => response(500).json(problem))];
}

/** Moves the Application for real, so a test reads the page the way a Recruiter would. */
export function reviewsApplication(review: ApplicationReview, asked?: PipelineStatus[]) {
  let current = review;
  return [
    http.get(REVIEW_PATH, ({ params, response }) =>
      params.application_id === current.id
        ? response(200).json(current)
        : response(404).json(NO_SUCH_APPLICATION),
    ),
    http.patch(REVIEW_PATH, async ({ request, response }) => {
      const { status } = (await request.json()) as StatusChange;
      asked?.push(status);
      const previous = current.status;
      const changed_at = '2026-08-03T10:00:00Z';
      current = {
        ...current,
        status,
        history: [
          ...current.history,
          { status, previous_status: previous, source: 'recruiter', changed_at },
        ],
        updated_at: changed_at,
      };
      return response(200).json({ id: current.id, status, previous_status: previous, changed_at });
    }),
  ];
}

export function refusesApplicationMove(review: ApplicationReview, problem: Problem) {
  return [
    ...getsApplication(review),
    http.patch(REVIEW_PATH, ({ response }) => response(409).json(problem)),
  ];
}

/** Holds the page open until the caller lets it arrive, so a test can see the skeleton. */
export function holdsJobApplications(items: ApplicationSummary[]) {
  let arrive: () => void = () => {};
  const held = new Promise<void>((resolve) => {
    arrive = resolve;
  });
  return {
    arrive: () => arrive(),
    handlers: [
      http.get(PATH, async ({ response }) => {
        await held;
        return response(200).json({ items, next_cursor: null });
      }),
    ],
  };
}
