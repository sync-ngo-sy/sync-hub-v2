/** A rejection carries the status only when the failure produced a body, hence the narrowing. */
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

export function problemDetail(error: unknown): string | null {
  if (typeof error !== 'object' || error === null) return null;
  const { detail, title } = error as { detail?: unknown; title?: unknown };
  if (typeof detail === 'string' && detail !== '') return detail;
  return typeof title === 'string' && title !== '' ? title : null;
}
