/** The HTTP status openapi-react-query's thrown error carries, when the response body has one. */
export function errorStatus(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null || !('status' in error)) return undefined;
  const { status } = error as { status: unknown };
  return typeof status === 'number' ? status : undefined;
}
