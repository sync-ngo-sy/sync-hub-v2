import { z } from 'zod';

function basePathname(value: string): string | null {
  if (value === '') return '';
  if (/^https?:\/\//.test(value)) {
    try {
      return new URL(value).pathname;
    } catch {
      return null;
    }
  }
  return value.startsWith('/') && !value.startsWith('//') ? value : null;
}

const clientEnvSchema = z.object({
  VITE_API_BASE_URL: z
    .string()
    .refine(
      (value) => basePathname(value) !== null,
      'must be empty (same-origin), a root-relative path, or an absolute http(s) URL',
    )
    .refine((value) => {
      const pathname = basePathname(value);
      return pathname === null || !pathname.replace(/\/+$/, '').endsWith('/v1');
    }, 'must not end in /v1 — the generated paths already carry that prefix'),
});

export interface ClientEnv {
  apiBaseUrl: string;
}

export function readClientEnv(source: Record<string, unknown>): ClientEnv {
  const result = clientEnvSchema.safeParse(source);
  if (!result.success) {
    const detail = result.error.issues
      .map((issue) => `${issue.path.join('.') || 'VITE_API_BASE_URL'}: ${issue.message}`)
      .join('; ');
    throw new Error(`[@sync/api-client] Invalid frontend environment — ${detail}`);
  }
  return { apiBaseUrl: result.data.VITE_API_BASE_URL };
}
