import type { components } from '@sync/api-client';

type ProblemDetail = components['schemas']['ProblemDetail'];
type InvalidField = components['schemas']['InvalidField'];
type ApiProblem = Partial<ProblemDetail & components['schemas']['ValidationProblemDetail']>;

/**
 * `openapi-react-query` rejects with the parsed body, so a failed call arrives as the API's
 * problem document — or, when the request never reached the API, as whatever `fetch` threw.
 */
function problemBody(error: unknown): ApiProblem | null {
  return typeof error === 'object' && error !== null && !(error instanceof Error)
    ? (error as ApiProblem)
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

export function problemFields(error: unknown): InvalidField[] {
  return problemBody(error)?.errors ?? [];
}

export function problemMessage(error: unknown, fallback: string): string {
  const body = problemBody(error);
  if (typeof body?.detail === 'string' && body.detail !== '') return body.detail;
  if (typeof body?.title === 'string' && body.title !== '') return body.title;
  return fallback;
}
