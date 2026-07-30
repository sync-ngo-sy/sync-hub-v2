import { z } from 'zod';

/** Path the base resolves to, or `null` when the value is not a usable base at all. */
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
  /** Base the generated `/v1/...` paths resolve against; empty means same-origin. */
  apiBaseUrl: string;
}

/**
 * Validate the frontend environment the API client depends on, throwing at startup rather
 * than letting a misconfiguration surface later as an opaque failed request. Callers pass
 * their bundler's env (`import.meta.env`); tests pass an explicit record.
 */
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
