// Console-only in v1; the seam every boundary calls into so a later Sentry adoption is one file.
export function reportError(error: unknown, context?: Record<string, unknown>): void {
  console.error('[candidate-portal]', error, context);
}
