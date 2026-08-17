import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { signedOut } from '@/features/auth/testing/handlers';
import { followsNoLink, resolvesTrackedLink } from '@/features/jobs/testing/handlers';
import { PUBLIC_JOB } from '@/testing/fixtures';
import { renderApp } from '@/testing/render-app';
import { server } from '@/testing/server';

const TOKEN = 'spring-2026';

describe('the Tracked-link landing', () => {
  it('opens on the Job itself, with the view counted and nothing about tracking on screen', async () => {
    const counted = vi.fn();
    server.use(...signedOut(), ...resolvesTrackedLink(PUBLIC_JOB, counted));

    const { router } = await renderApp(`/l/${TOKEN}`);

    expect(await screen.findByRole('heading', { level: 1, name: PUBLIC_JOB.title })).toBeVisible();
    expect(screen.getByText(/You will own the design system/)).toBeVisible();
    expect(counted).toHaveBeenCalledWith(TOKEN);
    expect(screen.queryByText(/campaign|tracked|referral/i)).toBeNull();
    expect(router.state.location.pathname).toBe(`/l/${TOKEN}`);
  });

  it('carries the Tenant logo onto the landing, as the board does', async () => {
    server.use(...signedOut(), ...resolvesTrackedLink(PUBLIC_JOB));

    await renderApp(`/l/${TOKEN}`);

    await screen.findByRole('heading', { level: 1, name: PUBLIC_JOB.title });
    expect(document.querySelector('[data-slot="tenant-logo"] img')).toHaveAttribute(
      'src',
      'http://sync.test/storage/v1/object/public/tenant-logos/levant/logo.webp',
    );
  });

  it('brings sign-in back to the link, so applying stays attributed to it', async () => {
    server.use(...signedOut(), ...resolvesTrackedLink(PUBLIC_JOB));

    const { router, user } = await renderApp(`/l/${TOKEN}`);

    await user.click(await screen.findByRole('link', { name: 'Sign in to apply' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(router.state.location.search).toEqual({ returnTo: `/l/${TOKEN}` });
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeVisible();
  });

  it('gives a link that no longer resolves a friendly way back to the board', async () => {
    server.use(...signedOut(), ...followsNoLink());

    await renderApp(`/l/${TOKEN}`);

    expect(await screen.findByRole('heading', { name: "This link didn't work" })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Browse jobs' })).toHaveAttribute('href', '/jobs');
  });
});
