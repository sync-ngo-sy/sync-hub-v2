/**
 * `openapi-react-query` throws the parsed error body, which for this API is always a
 * Problem Details document — so the HTTP status is readable off the rejection itself.
 */
export function problemStatus(error: unknown): number | null {
  if (typeof error !== 'object' || error === null) return null;
  const { status } = error as { status?: unknown };
  return typeof status === 'number' ? status : null;
}

export function isClientError(error: unknown): boolean {
  const status = problemStatus(error);
  return status !== null && status >= 400 && status < 500;
}

export function isUnauthorized(error: unknown): boolean {
  return problemStatus(error) === 401;
}

/** The `detail` a Problem Details document carries, when it has one worth showing. */
export function problemDetail(error: unknown): string | null {
  if (typeof error !== 'object' || error === null) return null;
  const { detail, title } = error as { detail?: unknown; title?: unknown };
  if (typeof detail === 'string' && detail !== '') return detail;
  return typeof title === 'string' && title !== '' ? title : null;
}
