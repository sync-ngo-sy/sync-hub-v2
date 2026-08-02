import type { components } from '@sync/api-client';

type Problem = Partial<components['schemas']['ProblemDetail']>;

function body(error: unknown): Problem | null {
  return typeof error === 'object' && error !== null && !(error instanceof Error)
    ? (error as Problem)
    : null;
}

export function problemStatus(error: unknown): number | null {
  const status = body(error)?.status;
  return typeof status === 'number' ? status : null;
}

export function problemMessage(error: unknown, fallback: string): string {
  const problem = body(error);
  return problem?.detail || problem?.title || fallback;
}
