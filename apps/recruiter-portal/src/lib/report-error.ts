export interface ErrorContext {
  boundary: 'app-shell' | 'route' | 'widget';
  source?: string;
}

export function reportError(error: unknown, context: ErrorContext): void {
  const where = context.source ? `${context.boundary}: ${context.source}` : context.boundary;
  console.error(`[${where}]`, error);
}
