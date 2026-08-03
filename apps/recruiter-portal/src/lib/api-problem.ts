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

export function isProblem(error: unknown, type: string): boolean {
  return problemBody(error)?.type === type;
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

/**
 * For the places that put a refusal beside the control that caused it, where the caller's own
 * sentence names that control and the problem's `title` — an HTTP phrase like "Conflict" —
 * would say less than the fallback it would otherwise win against.
 */
export function problemDetail(error: unknown, fallback: string): string {
  const detail = problemBody(error)?.detail;
  return typeof detail === 'string' && detail !== '' ? detail : fallback;
}

export interface FormRejection<Field extends string> {
  fields: { name: Field; message: string }[];
  root: string | null;
}

export function formRejection<Field extends string>(
  error: unknown,
  fieldFor: Record<string, Field>,
  fallback: string,
): FormRejection<Field> {
  const located = problemFields(error).map((entry) => ({
    name: fieldFor[entry.location],
    message: entry.message,
  }));
  const fields = located.filter(
    (entry): entry is { name: Field; message: string } => entry.name !== undefined,
  );

  return {
    fields,
    root:
      located.length > 0 && fields.length === located.length
        ? null
        : problemMessage(error, fallback),
  };
}
