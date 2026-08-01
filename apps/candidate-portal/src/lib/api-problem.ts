import type { components } from '@sync/api-client';

type ProblemDetail = components['schemas']['ProblemDetail'];
type InvalidField = components['schemas']['InvalidField'];

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

export function isProblem(error: unknown, type: string): boolean {
  return problemBody(error)?.type === type;
}

/** The fields a validation problem blames, each located as a dotted path like `body.email`. */
export function problemFields(error: unknown): InvalidField[] {
  const errors = (problemBody(error) as { errors?: unknown } | null)?.errors;
  if (!Array.isArray(errors)) return [];
  return errors.filter(
    (entry): entry is InvalidField =>
      typeof entry === 'object' &&
      entry !== null &&
      typeof entry.location === 'string' &&
      typeof entry.message === 'string',
  );
}

export function problemMessage(error: unknown, fallback: string): string {
  const body = problemBody(error);
  if (typeof body?.detail === 'string' && body.detail !== '') return body.detail;
  if (typeof body?.title === 'string' && body.title !== '') return body.title;
  return fallback;
}
