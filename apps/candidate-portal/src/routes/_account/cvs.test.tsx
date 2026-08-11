import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { signedInAs } from '@/features/auth/testing/handlers';
import { listsCvs } from '@/features/cvs/testing/handlers';
import { hasProfile } from '@/features/profile/testing/handlers';
import { CANDIDATE, CANDIDATE_PROFILE, READY_CV } from '@/testing/fixtures';
import { renderApp } from '@/testing/render-app';
import { server } from '@/testing/server';

describe('the address the CVs used to have', () => {
  it('lands on the profile, where the CVs are now', async () => {
    server.use(...signedInAs(CANDIDATE), ...hasProfile(CANDIDATE_PROFILE), ...listsCvs([READY_CV]));

    const { router } = await renderApp('/cvs');

    await waitFor(() => expect(router.state.location.pathname).toBe('/profile'));
    expect(await screen.findByRole('heading', { name: READY_CV.display_name })).toBeVisible();
  });

  it('leaves no step in the history to go back through', async () => {
    server.use(...signedInAs(CANDIDATE), ...hasProfile(CANDIDATE_PROFILE));

    const { router } = await renderApp('/cvs');

    await waitFor(() => expect(router.state.location.pathname).toBe('/profile'));
    expect(router.history.length).toBe(1);
  });
});
