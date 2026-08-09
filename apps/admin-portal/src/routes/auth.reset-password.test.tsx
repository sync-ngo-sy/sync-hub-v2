import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { resetsPassword, signedInAs, signedOut } from '@/features/auth/testing/handlers';
import { PLATFORM_ADMIN } from '@/testing/fixtures';
import { renderApp } from '@/testing/render-app';
import { server } from '@/testing/server';

describe('resetting a password', () => {
  it('clears a previously cached profile before returning to sign in', async () => {
    server.use(...signedInAs(PLATFORM_ADMIN), ...resetsPassword());

    const { router, user } = await renderApp('/overview');
    await router.navigate({ to: '/auth/reset-password', search: { token_hash: 'valid-token' } });
    server.use(...signedOut());
    await user.type(await screen.findByLabelText('New password'), 'CorrectHorse9');
    await user.click(screen.getByRole('button', { name: 'Save new password' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeVisible();
  });
});
