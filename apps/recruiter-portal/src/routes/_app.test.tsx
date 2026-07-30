import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  logsOut,
  signedInAsCandidate,
  signedInAsRecruiter,
} from '@/features/auth/testing/handlers';
import { NAV_ITEMS } from '@/features/shell/nav-items';
import { problem } from '@/testing/fixtures';
import { renderApp } from '@/testing/render-app';
import { http, server } from '@/testing/server';

describe('the workspace shell', () => {
  it('offers every destination the approved sidebar fixes, and names the workspace', async () => {
    server.use(...signedInAsRecruiter());

    await renderApp('/dashboard');

    const nav = within(await screen.findByRole('navigation', { name: 'Workspace' }));
    for (const { label } of NAV_ITEMS) {
      expect(nav.getByRole('link', { name: label })).toBeInTheDocument();
    }
    expect(await screen.findByText('Aman Relief')).toBeInTheDocument();
  });

  it('marks the destination you are on', async () => {
    server.use(...signedInAsRecruiter());

    const { router, user } = await renderApp('/dashboard');
    const nav = within(await screen.findByRole('navigation', { name: 'Workspace' }));

    expect(nav.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page');

    await user.click(nav.getByRole('link', { name: 'Templates' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/templates'));
    expect(nav.getByRole('link', { name: 'Templates' })).toHaveAttribute('aria-current', 'page');
    expect(nav.getByRole('link', { name: 'Dashboard' })).not.toHaveAttribute('aria-current');
  });

  it('keeps the same navigation behind a drawer, which closes on arrival', async () => {
    server.use(...signedInAsRecruiter());

    const { router, user } = await renderApp('/dashboard');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: 'Open navigation' }));

    const drawer = await screen.findByRole('dialog');
    await user.click(within(drawer).getByRole('link', { name: 'Jobs' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/jobs'));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('shows a not-found card for an address inside the workspace that does not exist', async () => {
    server.use(...signedInAsRecruiter());

    await renderApp('/dashboard/nowhere');

    expect(await screen.findByText('Page not found')).toBeInTheDocument();
  });
});

describe('the theme toggle', () => {
  it('restyles the app and remembers the choice', async () => {
    server.use(...signedInAsRecruiter());

    const { user } = await renderApp('/dashboard');

    await user.click(await screen.findByRole('button', { name: 'Switch to dark theme' }));

    expect(document.documentElement).toHaveClass('dark');
    expect(localStorage.getItem('sync-recruiter-theme')).toBe('dark');

    await user.click(await screen.findByRole('button', { name: 'Switch to light theme' }));

    expect(document.documentElement).not.toHaveClass('dark');
    expect(localStorage.getItem('sync-recruiter-theme')).toBe('light');
  });
});

describe('a candidate account opening the Recruiter Portal', () => {
  it('gets a screen naming the portal they belong in, not a bare error', async () => {
    server.use(...signedInAsCandidate());

    const { router } = await renderApp('/dashboard');

    expect(await screen.findByRole('heading', { name: /Candidate Portal/ })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Workspace' })).not.toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/wrong-portal');
  });

  it('is turned away before any of the workspace loads', async () => {
    server.use(...signedInAsCandidate());

    const { router } = await renderApp('/wrong-portal');

    expect(await screen.findByRole('heading', { name: /Candidate Portal/ })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/wrong-portal');
  });

  it('sends a recruiter who lands there back to the workspace', async () => {
    server.use(...signedInAsRecruiter());

    const { router } = await renderApp('/wrong-portal');

    await waitFor(() => expect(router.state.location.pathname).toBe('/dashboard'));
  });

  it('can sign out from there', async () => {
    server.use(...signedInAsCandidate(), logsOut());

    const { router, user } = await renderApp('/dashboard');

    await user.click(await screen.findByRole('button', { name: 'Sign out' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
  });
});

describe('a profile check that fails for a reason other than the session', () => {
  it('shows the app-shell boundary and reports through the seam', async () => {
    const reported = vi.spyOn(console, 'error').mockImplementation(() => {});
    server.use(
      http.get('/v1/auth/me', ({ response }) => response(500).json(problem(500, 'Server Error'))),
    );

    await renderApp('/dashboard');

    expect(
      await screen.findByRole('heading', { name: 'Something went wrong' }),
    ).toBeInTheDocument();
    expect(reported).toHaveBeenCalledWith('[app-shell]', expect.anything());
    reported.mockRestore();
  });
});
