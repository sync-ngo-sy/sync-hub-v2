/** Where the error happened, so a console line is enough to place it. */
export interface ErrorContext {
  boundary: 'app-shell' | 'route' | 'widget';
  /** The widget or route the boundary wraps. */
  source?: string;
}

/**
 * The one seam every boundary reports through. Console-only in v1; adopting Sentry means
 * changing this function and nothing else.
 */
export function reportError(error: unknown, context: ErrorContext): void {
  console.error(`[${context.boundary}${context.source ? `: ${context.source}` : ''}]`, error);
}
