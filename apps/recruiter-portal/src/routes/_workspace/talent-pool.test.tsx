import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { signedInAs } from '@/features/auth/testing/handlers';
import { AMINA_RECORD } from '@/features/candidates/testing/fixtures';
import { readsCandidate } from '@/features/candidates/testing/handlers';
import {
  AMINA_SAVED,
  MIGRATED_SAVED,
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

const THREE = [AMINA_SAVED, YOUSSEF_SAVED, RIMA_SAVED];

type User = Awaited<ReturnType<typeof renderApp>>['user'];

function saved() {
  return within(screen.getByRole('table', { name: 'Saved Candidates' }));
}

function names() {
  return saved()
    .getAllByRole('link', { name: /^Open / })
    .map((row) => row.getAttribute('aria-label'));
}

function searchField() {
  return screen.getByRole('searchbox', { name: 'Search your talent pool' });
}

async function search(user: User, words: string) {
  await user.clear(searchField());
  if (words !== '') await user.type(searchField(), words);
  await user.click(screen.getByRole('button', { name: 'Search' }));
}

async function sortBy(user: User, column: string) {
  await user.click(saved().getByRole('button', { name: column }));
}

async function openDrop(user: User, name: string) {
  await user.click(await screen.findByRole('button', { name: `Actions for ${name}` }));
  await user.click(await screen.findByRole('menuitem', { name: 'Drop from talent pool' }));
}

describe('the talent pool page', () => {
  it('lists the pool in the order the API sends it, most recently saved first', async () => {
    server.use(...signedInAs(RECRUITER), ...holdsTalentPool(THREE));

    await renderApp(AT);

    await waitFor(() =>
      expect(names()).toEqual(['Open Amina Haddad', 'Open Youssef Nassar', 'Open Rima Sabbagh']),
    );
    expect(screen.getByText('3 shown')).toBeVisible();
  });

  it('says who each Candidate is now, not only what they are called', async () => {
    server.use(...signedInAs(RECRUITER), ...holdsTalentPool([AMINA_SAVED]));

    await renderApp(AT);

    const row = await screen.findByRole('row', { name: /Amina Haddad/ });
    expect(within(row).queryByText('Backend engineer, 8 years')).toBeNull();
    expect(within(row).getByText('Backend Engineer')).toBeVisible();
    expect(within(row).getByText('8 years')).toBeVisible();
    expect(within(row).getByText('Aleppo')).toBeVisible();
    expect(within(row).getByText('AH')).toBeVisible();
  });

  it('says nothing rather than something invented about a Candidate who has said little', async () => {
    server.use(...signedInAs(RECRUITER), ...holdsTalentPool([RIMA_SAVED]));

    await renderApp(AT);

    const row = await screen.findByRole('row', { name: /Rima Sabbagh/ });
    expect(within(row).getAllByText('—')).toHaveLength(3);
    expect(within(row).getByText('0 years')).toBeVisible();
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
    expect(saved().getByRole('link', { name: 'Open Candidate 24' })).toBeVisible();
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
    server.use(
      ...signedInAs(RECRUITER),
      ...holdsTalentPool([AMINA_SAVED]),
      ...readsCandidate(AMINA_RECORD),
    );

    const { user, router } = await renderApp(AT);

    await user.click(await saved().findByRole('link', { name: 'Open Amina Haddad' }));

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

    expect(await saved().findByRole('link', { name: 'Open Amina Haddad' })).toBeVisible();
  });
});

describe('narrowing a talent pool that has grown', () => {
  it('keeps only the people the words reach', async () => {
    server.use(...signedInAs(RECRUITER), ...holdsTalentPool(THREE));

    const { user } = await renderApp(AT);
    await waitFor(() => expect(names()).toHaveLength(3));

    await search(user, 'nurse');

    await waitFor(() => expect(names()).toEqual(['Open Youssef Nassar']));
  });

  it('asks the API rather than sieving the pool in the browser', async () => {
    server.use(...signedInAs(RECRUITER), ...holdsTalentPool(THREE));

    const { user, router } = await renderApp(AT);
    await search(user, 'nurse');

    await waitFor(() => expect(router.state.location.search).toEqual({ q: 'nurse' }));
  });

  it('opens already narrowed when its address says so', async () => {
    server.use(...signedInAs(RECRUITER), ...holdsTalentPool(THREE));

    await renderApp(`${AT}?q=haddad`);

    await waitFor(() => expect(names()).toEqual(['Open Amina Haddad']));
    expect(searchField()).toHaveValue('haddad');
  });

  it('says the pool holds nobody by that name, and hands the whole pool back', async () => {
    server.use(...signedInAs(RECRUITER), ...holdsTalentPool(THREE));

    const { user } = await renderApp(AT);
    await search(user, 'astronaut');

    expect(
      await screen.findByText(
        'Nobody in your talent pool reads as “astronaut”. The words are matched against names and headlines.',
      ),
    ).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Clear search' }));

    await waitFor(() => expect(names()).toHaveLength(3));
    expect(searchField()).toHaveValue('');
  });
});

describe('reading the talent pool in an order of your own', () => {
  it('turns the pool around by name, and back again', async () => {
    server.use(...signedInAs(RECRUITER), ...holdsTalentPool(THREE));

    const { user, router } = await renderApp(AT);
    await waitFor(() => expect(names()).toHaveLength(3));

    await sortBy(user, 'Candidate');
    await waitFor(() =>
      expect(names()).toEqual(['Open Amina Haddad', 'Open Rima Sabbagh', 'Open Youssef Nassar']),
    );
    expect(router.state.location.search).toEqual({ sort: 'name' });

    await sortBy(user, 'Candidate');
    await waitFor(() =>
      expect(names()).toEqual(['Open Youssef Nassar', 'Open Rima Sabbagh', 'Open Amina Haddad']),
    );
    expect(router.state.location.search).toEqual({ sort: 'name_reversed' });
  });

  it('turns the pool around by the day it was saved, and back again', async () => {
    server.use(...signedInAs(RECRUITER), ...holdsTalentPool(THREE));

    const { user, router } = await renderApp(AT);
    await waitFor(() => expect(names()).toHaveLength(3));

    await sortBy(user, 'Saved');
    await waitFor(() =>
      expect(names()).toEqual(['Open Rima Sabbagh', 'Open Youssef Nassar', 'Open Amina Haddad']),
    );
    expect(router.state.location.search).toEqual({ sort: 'oldest' });

    await sortBy(user, 'Saved');
    await waitFor(() =>
      expect(names()).toEqual(['Open Amina Haddad', 'Open Youssef Nassar', 'Open Rima Sabbagh']),
    );
    expect(router.state.location.search).toEqual({});
  });

  it('says in the table which column the order is running on', async () => {
    server.use(...signedInAs(RECRUITER), ...holdsTalentPool(THREE));

    await renderApp(`${AT}?sort=name`);

    await waitFor(() => expect(names()).toHaveLength(3));
    expect(saved().getByRole('columnheader', { name: 'Candidate' })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );
    expect(saved().getByRole('columnheader', { name: 'Saved' })).not.toHaveAttribute('aria-sort');
  });

  it('opens in the order its address asks for', async () => {
    server.use(...signedInAs(RECRUITER), ...holdsTalentPool(THREE));

    await renderApp(`${AT}?sort=name_reversed`);

    await waitFor(() =>
      expect(names()).toEqual(['Open Youssef Nassar', 'Open Rima Sabbagh', 'Open Amina Haddad']),
    );
  });

  it('keeps the words when the order changes', async () => {
    server.use(...signedInAs(RECRUITER), ...holdsTalentPool(THREE));

    const { user, router } = await renderApp(`${AT}?q=a`);
    await waitFor(() => expect(names()).toHaveLength(3));

    await sortBy(user, 'Candidate');

    await waitFor(() => expect(router.state.location.search).toEqual({ q: 'a', sort: 'name' }));
  });

  it('reads an order it does not offer as the one it opens in', async () => {
    server.use(...signedInAs(RECRUITER), ...holdsTalentPool(THREE));

    await renderApp(`${AT}?sort=cheapest`);

    await waitFor(() =>
      expect(names()).toEqual(['Open Amina Haddad', 'Open Youssef Nassar', 'Open Rima Sabbagh']),
    );
  });
});

describe('the Tags a row carries', () => {
  it('holds a long list back so a row stays one line tall', async () => {
    server.use(...signedInAs(RECRUITER), ...holdsTalentPool([AMINA_SAVED]));

    await renderApp(AT);

    const tags = within(
      await screen.findByRole('list', { name: 'Tags on Amina Haddad' }),
    ).getAllByRole('listitem');
    expect(tags.map((tag) => tag.textContent)).toEqual([
      'Arabic speaker',
      'Interviewed',
      '+2 more',
    ]);
  });

  it('shows the rest on hover, without opening the Candidate', async () => {
    server.use(...signedInAs(RECRUITER), ...holdsTalentPool([AMINA_SAVED]));

    const { user, router } = await renderApp(AT);

    await user.click(await screen.findByRole('button', { name: '+2 more' }));

    expect(await screen.findByText('Referred')).toBeVisible();
    expect(screen.getByText('Shortlisted')).toBeVisible();
    expect(router.state.location.pathname).toBe(AT);
  });
});

describe('dropping a Candidate from the talent pool', () => {
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
    expect(saved().getByRole('link', { name: 'Open Amina Haddad' })).toBeVisible();
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
    server.use(
      ...signedInAs(RECRUITER),
      ...keepsTalentPool([AMINA_SAVED]),
      ...readsCandidate(AMINA_RECORD),
    );

    const { user, router } = await renderApp(AT);

    await user.click(await saved().findByRole('link', { name: 'Open Amina Haddad' }));
    expect(await screen.findByText('Amina Haddad is in your talent pool.')).toBeVisible();

    await router.navigate({ to: AT, search: {} });
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

    expect(await screen.findByText('Amina Haddad is not in your talent pool.')).toBeVisible();
  });

  it('drops out of a narrowed reading too, which is a page of its own', async () => {
    server.use(...signedInAs(RECRUITER), ...keepsTalentPool([AMINA_SAVED, YOUSSEF_SAVED]));

    const { user } = await renderApp(`${AT}?q=haddad`);
    await waitFor(() => expect(names()).toEqual(['Open Amina Haddad']));

    await openDrop(user, 'Amina Haddad');
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: 'Drop from talent pool',
      }),
    );

    expect(
      await screen.findByText(
        'Nobody in your talent pool reads as “haddad”. The words are matched against names and headlines.',
      ),
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

describe('where a pooled Candidate came from', () => {
  it('marks somebody a migration brought across and nobody has claimed', async () => {
    server.use(...signedInAs(RECRUITER), ...holdsTalentPool([MIGRATED_SAVED]));

    await renderApp(AT);

    const row = within(await saved().findByRole('row', { name: /Bashir Nassar/ }));
    expect(row.getByText('Imported · unclaimed')).toBeVisible();
  });

  it('says a migrated Candidate has since signed in', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...holdsTalentPool([{ ...MIGRATED_SAVED, is_claimed: true }]),
    );

    await renderApp(AT);

    const row = within(await saved().findByRole('row', { name: /Bashir Nassar/ }));
    expect(row.getByText('Imported')).toBeVisible();
  });

  it('says nothing about somebody who signed themselves up', async () => {
    server.use(...signedInAs(RECRUITER), ...holdsTalentPool([AMINA_SAVED]));

    await renderApp(AT);

    const row = within(await saved().findByRole('row', { name: /Amina/ }));
    expect(row.queryByText(/Imported/)).not.toBeInTheDocument();
  });
});
