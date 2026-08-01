import { vi } from 'vitest';

/** jsdom ships no matchMedia, and the theme, the responsive chrome and the motion preference
 * all read it. `matches` decides per query, so a test can flip one preference on. */
export function stubMatchMedia(matches: (query: string) => boolean) {
  return (query: string) =>
    ({
      matches: matches(query),
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }) as unknown as MediaQueryList;
}
