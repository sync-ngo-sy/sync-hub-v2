import type { components } from '@sync/api-client';
import { http } from '@sync/api-client/testing';
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { signedInAs } from '@/features/auth/testing/handlers';
import { PLATFORM_ADMIN } from '@/testing/fixtures';
import { renderApp } from '@/testing/render-app';
import { server } from '@/testing/server';

const overview: components['schemas']['PlatformOverviewView'] = {
  tenants: 12,
  candidates: 345,
  jobs: 67,
  applications: 890,
};

describe('the platform overview', () => {
  it('shows the platform-wide counts', async () => {
    server.use(
      ...signedInAs(PLATFORM_ADMIN),
      http.get('/v1/platform/overview', ({ response }) => response(200).json(overview)),
    );

    await renderApp('/overview');

    expect(await screen.findByText('12')).toBeVisible();
    expect(screen.getAllByText('Tenants')).toHaveLength(2);
    expect(screen.getByText('Candidates')).toBeVisible();
    expect(screen.getByText('345')).toBeVisible();
    expect(screen.getByText('Jobs')).toBeVisible();
    expect(screen.getByText('67')).toBeVisible();
    expect(screen.getByText('Applications')).toBeVisible();
    expect(screen.getByText('890')).toBeVisible();
  });
});
