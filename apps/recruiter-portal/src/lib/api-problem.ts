/**
 * `openapi-react-query` rejects with the parsed response body, so a failed call arrives
 * as the API's RFC 9457 problem document — or, when the request never reached the API,
 * as whatever `fetch` threw. These readers narrow both without pretending to know which.
 */
function problemBody(error: unknown): Record<string, unknown> | null {
  return typeof error === 'object' && error !== null && !(error instanceof Error)
    ? (error as Record<string, unknown>)
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
  const detail = body?.detail;
  if (typeof detail === 'string' && detail !== '') return detail;
  const title = body?.title;
  if (typeof title === 'string' && title !== '') return title;
  return fallback;
}
