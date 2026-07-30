import { readClientEnv } from '@sync/api-client';

/** An unset base URL means same-origin, which is both the dev and the production topology. */
export const env = readClientEnv(import.meta.env);
