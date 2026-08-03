import type { components } from '@sync/api-client';
import { http } from '@sync/api-client/testing';
import type { ApplicationSummary } from '../application';

type Problem = components['schemas']['ProblemDetail'];

const PATH = '/v1/tenants/me/jobs/{job_id}/applications';

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
