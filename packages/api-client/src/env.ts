import { z } from 'zod';

function basePath(value: string): string | null {
  if (value === '') return '';
  if (/^https?:\/\//i.test(value)) {
    try {
      return new URL(value).pathname;
    } catch {
      return null;
    }
  }
  return value.startsWith('/') && !value.startsWith('//') ? value : null;
}

function carriesVersionPrefix(path: string): boolean {
  return path.replace(/\/+$/, '').endsWith('/v1');
}

const clientEnvSchema = z.object({
  VITE_API_BASE_URL: z.string().superRefine((value, ctx) => {
    const path = basePath(value);
    if (path === null) {
      ctx.addIssue({
        code: 'custom',
        message: 'must be empty (same-origin), a root-relative path, or an absolute http(s) URL',
      });
      return;
    }
    if (carriesVersionPrefix(path)) {
      ctx.addIssue({
        code: 'custom',
        message: 'must not end in /v1 — the generated paths already carry that prefix',
      });
    }
  }),
});

export interface ClientEnv {
  apiBaseUrl: string;
}

export function readClientEnv(source: Record<string, unknown>): ClientEnv {
  const result = clientEnvSchema.safeParse(source);
  if (!result.success) {
    const detail = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`[@sync/api-client] Invalid frontend environment — ${detail}`);
  }
  return { apiBaseUrl: result.data.VITE_API_BASE_URL };
}
