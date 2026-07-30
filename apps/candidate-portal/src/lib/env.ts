import { readClientEnv } from '@sync/api-client';

// Fails loudly at import time — before the app renders a single broken request.
export const clientEnv = readClientEnv(import.meta.env);
