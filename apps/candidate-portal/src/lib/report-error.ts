export interface ErrorContext {
  boundary: 'app-shell' | 'route' | 'widget';
  source?: string;
}

/** The one seam every boundary reports through; adopting Sentry means editing this file only. */
export function reportError(error: unknown, context: ErrorContext): void {
  const where = context.source ? `${context.boundary}: ${context.source}` : context.boundary;
  console.error(`[${where}]`, error);
}
