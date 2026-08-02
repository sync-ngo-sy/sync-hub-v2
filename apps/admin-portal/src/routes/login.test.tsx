import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { logsIn, signedOut } from '@/features/auth/testing/handlers';
import { PLATFORM_ADMIN } from '@/testing/fixtures';
import { renderApp } from '@/testing/render-app';
import { server } from '@/testing/server';

describe('signing in', () => {
  it('ignores a backslash-prefixed authority return target', async () => {
    server.use(...signedOut(), ...logsIn(PLATFORM_ADMIN));

    const { router, user } = await renderApp('/login?returnTo=%2F%5Cevil.test%2Fsteal');
    await user.type(screen.getByLabelText('Email'), PLATFORM_ADMIN.email);
    await user.type(screen.getByLabelText('Password'), 'correct-horse-battery');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/overview'));
    expect(await screen.findByRole('heading', { name: 'Platform overview' })).toBeVisible();
  });
});
