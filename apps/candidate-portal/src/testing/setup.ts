import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';
import { stubMatchMedia } from './media-query';
import { server } from './server';

window.matchMedia ??= stubMatchMedia(() => false);

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
