export interface ErrorContext {
  boundary: 'app-shell' | 'route' | 'widget';
  source?: string;
}

/** The one seam every boundary reports through; adopting Sentry means changing only this. */
export function reportError(error: unknown, context: ErrorContext): void {
  console.error(`[${context.boundary}${context.source ? `: ${context.source}` : ''}]`, error);
}
