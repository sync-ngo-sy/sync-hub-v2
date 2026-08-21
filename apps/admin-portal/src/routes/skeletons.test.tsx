import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { holdsSession, signedInAs } from '@/features/auth/testing/handlers';
import { PLATFORM_COUNTS } from '@/features/platform/platform-counts';
import { PLATFORM_ADMIN } from '@/testing/fixtures';
import { startApp } from '@/testing/render-app';
import { server } from '@/testing/server';

const ARRIVING = { timeout: 5_000 };

function bars() {
  return document.querySelectorAll('[data-slot="skeleton"]');
}

function statCells() {
  return document.querySelectorAll('[data-slot="stat"]');
}

describe('a platform route that is still arriving', () => {
  it('holds the platform chrome open while the session is on the wire', async () => {
    const held = holdsSession(PLATFORM_ADMIN);
    server.use(...held.handlers);

    startApp('/tenants');

    const arriving = await screen.findByRole('status', { name: 'Loading the Platform' }, ARRIVING);

    expect(bars().length).toBeGreaterThan(0);
    expect(within(arriving).queryByRole('table')).toBeNull();

    held.arrive();

    expect(await screen.findByRole('heading', { name: 'Tenants' })).toBeVisible();
  });

  it('shows the counts the overview really has while they arrive', async () => {
    server.use(...signedInAs(PLATFORM_ADMIN));

    startApp('/overview');

    expect(
      await screen.findByRole('status', { name: 'Loading the platform counts' }, ARRIVING),
    ).toBeInTheDocument();
    expect(statCells()).toHaveLength(PLATFORM_COUNTS.length);
  });
});
