import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Testing Library only auto-registers cleanup when Vitest runs with globals; this suite
// imports its helpers explicitly, so the teardown is wired here instead.
afterEach(cleanup);
