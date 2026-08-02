import { readClientEnv } from '@sync/api-client';

export const env = readClientEnv({
  VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL ?? '',
});
