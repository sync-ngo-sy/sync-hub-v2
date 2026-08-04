import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { signedInAs } from '@/features/auth/testing/handlers';
import {
  AMINA_SAVED,
  RIMA_SAVED,
  savedCandidates,
  YOUSSEF_SAVED,
} from '@/features/talent-pool/testing/fixtures';
import {
  failsToReadTalentPool,
  holdsTalentPool,
  keepsTalentPool,
  refusesTalentPoolChange,
} from '@/features/talent-pool/testing/handlers';
import { absoluteDateTime } from '@/lib/dates';
import { RECRUITER, SERVER_FAULT } from '@/testing/fixtures';
import { renderApp } from '@/testing/render-app';
import { server } from '@/testing/server';

const AT = '/talent-pool';

function saved() {
  return within(screen.getByRole('table', { name: 'Saved Candidates' }));
}

function names() {
  return saved()
    .getAllByRole('button', { name: /^Open / })
    .map((row) => row.getAttribute('aria-label'));
}

async function openDrop(user: { click: (element: Element) => Promise<void> }, name: string) {
  await user.click(await screen.findByRole('button', { name: `Actions for ${name}` }));
  await user.click(await screen.findByRole('menuitem', { name: 'Drop from talent pool' }));
}

describe('the talent pool page', () => {
  it('lists the pool in the order the API sends it, most recently saved first', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...holdsTalentPool([AMINA_SAVED, YOUSSEF_SAVED, RIMA_SAVED]),
    );

    await renderApp(AT);

    await waitFor(() =>
      expect(names()).toEqual(['Open Amina Haddad', 'Open Youssef Nassar', 'Open Rima Sabbagh']),
    );
    expect(saved().getByText('Backend engineer, 8 years · Aleppo')).toBeVisible();
    expect(screen.getByText('3 shown')).toBeVisible();
  });

  it('says when each Candidate was saved', async () => {
    server.use(...signedInAs(RECRUITER), ...holdsTalentPool([AMINA_SAVED]));

    await renderApp(AT);

    const row = await screen.findByRole('row', { name: /Amina Haddad/ });
    expect(within(row).getByTitle(absoluteDateTime(AMINA_SAVED.added_at))).toHaveAttribute(
      'datetime',
      AMINA_SAVED.added_at,
    );
  });

  it('brings the next page in on request rather than reading the whole pool at once', async () => {
    server.use(...signedInAs(RECRUITER), ...holdsTalentPool(savedCandidates(25)));

    const { user } = await renderApp(AT);

    expect(await screen.findByText('20 shown')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Load more' }));

    expect(await screen.findByText('25 shown')).toBeVisible();
    expect(saved().getByRole('button', { name: 'Open Candidate 24' })).toBeVisible();
  });

  it('sends a Recruiter with an empty pool to candidate search', async () => {
    server.use(...signedInAs(RECRUITER), ...holdsTalentPool([]));

    const { user, router } = await renderApp(AT);

    expect(
      await screen.findByText(
        'Nobody saved yet — search reaches every Candidate on the platform who has opted into being found.',
      ),
    ).toBeVisible();

    await user.click(screen.getByRole('link', { name: 'Search for candidates' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/candidates'));
  });

  it('opens the Candidate view from a row', async () => {
    server.use(...signedInAs(RECRUITER), ...holdsTalentPool([AMINA_SAVED]));

    const { user, router } = await renderApp(AT);

    await user.click(await saved().findByRole('button', { name: 'Open Amina Haddad' }));

    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`/candidates/${AMINA_SAVED.candidate_id}`),
    );
    expect(await screen.findByRole('heading', { level: 1, name: 'Amina Haddad' })).toBeVisible();
  });

  it('says in the server’s words why the pool could not be read, and reads it again on request', async () => {
    server.use(...signedInAs(RECRUITER), ...failsToReadTalentPool(SERVER_FAULT));

    const { user } = await renderApp(AT);

    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong on our side.');

    server.use(...holdsTalentPool([AMINA_SAVED]));
    await user.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await saved().findByRole('button', { name: 'Open Amina Haddad' })).toBeVisible();
  });

  it('asks before dropping, and drops nobody when the asking is cancelled', async () => {
    const asked: string[] = [];
    server.use(...signedInAs(RECRUITER), ...keepsTalentPool([AMINA_SAVED, YOUSSEF_SAVED], asked));

    const { user } = await renderApp(AT);
    await openDrop(user, 'Amina Haddad');

    const asking = await screen.findByRole('alertdialog');
    expect(asking).toHaveTextContent('Drop Amina Haddad from your talent pool?');
    await user.click(within(asking).getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(asked).toEqual([]);
    expect(saved().getByRole('button', { name: 'Open Amina Haddad' })).toBeVisible();
  });

  it('drops a Candidate once confirmed, and takes their row off the list', async () => {
    const asked: string[] = [];
    server.use(...signedInAs(RECRUITER), ...keepsTalentPool([AMINA_SAVED, YOUSSEF_SAVED], asked));

    const { user } = await renderApp(AT);
    await openDrop(user, 'Amina Haddad');
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: 'Drop from talent pool',
      }),
    );

    await waitFor(() => expect(asked).toEqual([`drop ${AMINA_SAVED.candidate_id}`]));
    expect(await screen.findByText('Amina Haddad dropped from your talent pool')).toBeVisible();
    await waitFor(() => expect(names()).toEqual(['Open Youssef Nassar']));
  });

  it('drops the Candidate out of every reading of the pool, not only out of the list', async () => {
    server.use(...signedInAs(RECRUITER), ...keepsTalentPool([AMINA_SAVED]));

    const { user, router } = await renderApp(AT);

    // The Candidate view is what reads the pool whole, so opening it first is what leaves a
    // second copy behind for the drop to have to reach.
    await user.click(await saved().findByRole('button', { name: 'Open Amina Haddad' }));
    expect(await screen.findByText('Amina Haddad is in your talent pool.')).toBeVisible();

    await router.navigate({ to: AT });
    await openDrop(user, 'Amina Haddad');
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: 'Drop from talent pool',
      }),
    );
    await screen.findByText('Amina Haddad dropped from your talent pool');

    await router.navigate({
      to: '/candidates/$candidateId',
      params: { candidateId: AMINA_SAVED.candidate_id },
      search: {},
    });

    expect(
      await screen.findByRole('heading', { level: 1, name: 'This Candidate can’t be shown' }),
    ).toBeVisible();
  });

  it('keeps the row and the confirmation when a drop is refused', async () => {
    server.use(...signedInAs(RECRUITER), ...refusesTalentPoolChange([AMINA_SAVED], SERVER_FAULT));

    const { user } = await renderApp(AT);
    await openDrop(user, 'Amina Haddad');
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: 'Drop from talent pool',
      }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong on our side.');

    const asking = screen.getByRole('alertdialog');
    expect(asking).toBeVisible();
    await user.click(within(asking).getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(names()).toEqual(['Open Amina Haddad']));
  });
});
