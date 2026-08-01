import type { components } from '@sync/api-client';
import { http } from '@sync/api-client/testing';
import { delay } from 'msw';

type Application = components['schemas']['Application'];
type ApplicationConflict = components['schemas']['ApplicationConflictProblemDetail'];
type SubmissionRefused = components['schemas']['SubmissionRefusedProblemDetail'];
type NewApplication = components['schemas']['NewApplication'];
type Problem = components['schemas']['ProblemDetail'];
type MovedApplication = components['schemas']['MovedApplication'];

export function listsApplications(items: Application[]) {
  return [
    http.get('/v1/applications', ({ response }) =>
      response(200).json({ items, next_cursor: null }),
    ),
  ];
}

export function listsApplicationsInTurn(...batches: Application[][]) {
  let call = 0;
  return [
    http.get('/v1/applications', ({ response }) => {
      const items = batches[Math.min(call, batches.length - 1)] ?? [];
      call += 1;
      return response(200).json({ items, next_cursor: null });
    }),
  ];
}

export function pagesApplications(pages: Application[][]) {
  return [
    http.get('/v1/applications', ({ response, query }) => {
      const cursor = query.get('cursor');
      const index = cursor === null ? 0 : Number(cursor);
      return response(200).json({
        items: pages[index] ?? [],
        next_cursor: index + 1 < pages.length ? String(index + 1) : null,
      });
    }),
  ];
}

export function withholdsApplications() {
  return [
    http.get('/v1/applications', async ({ response }) => {
      await delay('infinite');
      return response(200).json({ items: [], next_cursor: null });
    }),
  ];
}

export function faultsOnApplications(problem: Problem) {
  return [http.get('/v1/applications', ({ response }) => response(500).json(problem))];
}

export function acceptsApplication(
  application: Application,
  onSubmit?: (body: NewApplication) => void,
) {
  return [
    http.post('/v1/applications', async ({ request, response }) => {
      onSubmit?.((await request.json()) as NewApplication);
      return response(201).json(application);
    }),
  ];
}

export function refusesApplication(problem: ApplicationConflict) {
  return [http.post('/v1/applications', ({ response }) => response(409).json(problem))];
}

export function refusesApplicationAnswers(problem: SubmissionRefused) {
  return [http.post('/v1/applications', ({ response }) => response(422).json(problem))];
}

export function withholdsApplication() {
  return [
    http.post('/v1/applications', async ({ response }) => {
      await delay('infinite');
      return response(201).json({} as Application);
    }),
  ];
}

export function withdrawsApplication(
  moved: MovedApplication,
  onWithdraw?: (applicationId: string) => void,
) {
  return [
    http.post('/v1/applications/{application_id}/withdraw', ({ params, response }) => {
      onWithdraw?.(params.application_id);
      return response(200).json(moved);
    }),
  ];
}

export function withholdsWithdrawal() {
  return [
    http.post('/v1/applications/{application_id}/withdraw', async ({ response }) => {
      await delay('infinite');
      return response(200).json({} as MovedApplication);
    }),
  ];
}

export function refusesWithdrawal(problem: Problem) {
  return [
    http.post('/v1/applications/{application_id}/withdraw', ({ response }) =>
      response(409).json(problem),
    ),
  ];
}
