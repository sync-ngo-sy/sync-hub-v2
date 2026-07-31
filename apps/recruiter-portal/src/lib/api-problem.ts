import type { components } from '@sync/api-client';

type ProblemDetail = components['schemas']['ProblemDetail'];

/**
 * `openapi-react-query` rejects with the parsed body, so a failed call arrives as the API's
 * problem document — or, when the request never reached the API, as whatever `fetch` threw.
 */
function problemBody(error: unknown): Partial<ProblemDetail> | null {
  return typeof error === 'object' && error !== null && !(error instanceof Error)
    ? (error as Partial<ProblemDetail>)
    : null;
}

export function problemStatus(error: unknown): number | null {
  const status = problemBody(error)?.status;
  return typeof status === 'number' ? status : null;
}

export function isClientError(error: unknown): boolean {
  const status = problemStatus(error);
  return status !== null && status >= 400 && status < 500;
}

export function problemMessage(error: unknown, fallback: string): string {
  const body = problemBody(error);
  if (typeof body?.detail === 'string' && body.detail !== '') return body.detail;
  if (typeof body?.title === 'string' && body.title !== '') return body.title;
  return fallback;
}
