import { http, PROBLEM } from '@sync/api-client/testing';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderApp } from '../testing/render-app';
import { server } from '../testing/server';

const HEADLINE = "Syria's jobs, in one clear place.";

function tenant(name: string, slug: string) {
  return { name, slug };
}

const DAY = 86_400_000;
const JOBS = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    title: 'Frontend Developer (Remote)',
    tenant: tenant('Levant Digital', 'levant-digital'),
    location: 'Remote',
    employment_type: 'Full-time',
    created_at: new Date(Date.now() - 2 * DAY).toISOString(),
    expires_at: null,
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    title: 'Field Coordinator',
    tenant: tenant('Aman Relief', 'aman-relief'),
    location: 'Aleppo',
    employment_type: 'Contract',
    created_at: new Date(Date.now() - 4 * DAY).toISOString(),
    expires_at: null,
  },
];

/** Every landing test renders as an anonymous visitor: signed out, refresh fails, no bounce. */
function anonymous() {
  return [
    http.get('/v1/auth/me', ({ response }) => response(401).json(PROBLEM)),
    http.post('/v1/auth/refresh', ({ response }) => response(401).json(PROBLEM)),
  ];
}

/** Force `prefers-reduced-motion` on or off before mount; the theme provider also reads matchMedia. */
function setReducedMotion(reduced: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query.includes('prefers-reduced-motion') ? reduced : false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

describe('candidate landing', () => {
  const realMatchMedia = window.matchMedia;
  afterEach(() => {
    window.matchMedia = realMatchMedia;
  });

  describe('jobs index', () => {
    it('lists the newest published jobs, in order, each linking to its detail page', async () => {
      server.use(
        ...anonymous(),
        http.get('/v1/jobs', ({ response }) =>
          response(200).json({ items: JOBS, next_cursor: null }),
        ),
      );

      renderApp('/');

      const first = await screen.findByRole('link', { name: /Frontend Developer/ });
      expect(first).toHaveAttribute('href', '/jobs/11111111-1111-1111-1111-111111111111');
      expect(screen.getByText('Levant Digital · Remote · Full-time')).toBeInTheDocument();
      expect(screen.getByText('2 days ago')).toBeInTheDocument();

      const second = screen.getByRole('link', { name: /Field Coordinator/ });
      expect(second).toHaveAttribute('href', '/jobs/22222222-2222-2222-2222-222222222222');
      // Newest first: the API's order is preserved in the DOM.
      expect(first.compareDocumentPosition(second)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);

      expect(screen.getByRole('link', { name: /Browse all jobs/ })).toHaveAttribute(
        'href',
        '/jobs',
      );
    });

    it('shows a designed empty state when there are no open roles', async () => {
      server.use(
        ...anonymous(),
        http.get('/v1/jobs', ({ response }) =>
          response(200).json({ items: [], next_cursor: null }),
        ),
      );

      renderApp('/');

      expect(await screen.findByText('No open roles right now')).toBeInTheDocument();
    });

    it('shows a loading skeleton while the jobs are in flight', async () => {
      server.use(
        ...anonymous(),
        http.get('/v1/jobs', async ({ response }) => {
          await new Promise((resolve) => setTimeout(resolve, 10_000));
          return response(200).json({ items: [], next_cursor: null });
        }),
      );

      renderApp('/');

      expect(await screen.findByRole('status', { name: 'Loading open roles' })).toBeInTheDocument();
    });

    it('degrades to an inline retry on failure, and recovers when retried', async () => {
      let ok = false;
      server.use(
        ...anonymous(),
        http.get('/v1/jobs', ({ response }) =>
          ok
            ? response(200).json({ items: JOBS, next_cursor: null })
            : response(500).json({ ...PROBLEM, status: 500, title: 'Server error' }),
        ),
      );

      renderApp('/');

      expect(await screen.findByText("Couldn't load open roles")).toBeInTheDocument();
      // The hero still stands while the widget is down.
      expect(screen.getByRole('heading', { name: HEADLINE })).toBeInTheDocument();

      ok = true;
      await userEvent.click(screen.getByRole('button', { name: 'Retry' }));

      expect(await screen.findByRole('link', { name: /Frontend Developer/ })).toBeInTheDocument();
      expect(screen.queryByText("Couldn't load open roles")).not.toBeInTheDocument();
    });
  });

  describe('typewriter hero', () => {
    it('animates on load: the full headline reads as one heading, with the caret present', async () => {
      setReducedMotion(false);
      server.use(
        ...anonymous(),
        http.get('/v1/jobs', ({ response }) =>
          response(200).json({ items: [], next_cursor: null }),
        ),
      );

      renderApp('/');

      expect(await screen.findByRole('heading', { name: HEADLINE })).toBeInTheDocument();
      // The animated chunk mounts and adds the resting caret.
      expect(await screen.findByTestId('hero-caret')).toBeInTheDocument();
    });

    it('collapses to static text under reduced motion: same heading, no caret', async () => {
      setReducedMotion(true);
      server.use(
        ...anonymous(),
        http.get('/v1/jobs', ({ response }) =>
          response(200).json({ items: [], next_cursor: null }),
        ),
      );

      renderApp('/');

      const heading = await screen.findByRole('heading', { name: HEADLINE });
      expect(heading).toBeInTheDocument();
      await waitFor(() => expect(screen.getByText('No open roles right now')).toBeInTheDocument());
      expect(screen.queryByTestId('hero-caret')).not.toBeInTheDocument();
      // The teal accent word is still there, just not animated.
      expect(within(heading).getByText('clear')).toBeInTheDocument();
    });
  });
});
