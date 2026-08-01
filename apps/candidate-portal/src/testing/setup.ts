import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';
import { server } from './server';

configure({ asyncUtilTimeout: 5_000 });

// jsdom ships neither, and the theme and the responsive chrome both read them.
window.matchMedia ??= (query: string) =>
  ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }) as unknown as MediaQueryList;

// jsdom defines scrollTo only to throw "not implemented", so this replaces rather than fills in.
window.scrollTo = vi.fn();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

afterEach(() => {
  cleanup();
  server.resetHandlers();
  localStorage.clear();
  document.documentElement.className = '';
});

afterAll(() => server.close());
