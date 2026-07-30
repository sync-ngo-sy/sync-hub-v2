import { z } from 'zod';

const clientEnvSchema = z.object({
  VITE_API_BASE_URL: z
    .string()
    .refine(
      (value) => value === '' || /^https?:\/\//.test(value),
      'must be empty (same-origin) or an absolute http(s) URL — the generated paths already include /v1',
    ),
});

export interface ClientEnv {
  /** Origin the generated `/v1/...` paths resolve against; empty means same-origin. */
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
