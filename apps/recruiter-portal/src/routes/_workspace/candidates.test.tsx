import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { signedInAs } from '@/features/auth/testing/handlers';
import { AMINA, SEARCH_OFFLINE, YOUSSEF } from '@/features/candidates/testing/fixtures';
import {
  type AskedSearch,
  failsToSearchCandidates,
  findsCandidates,
} from '@/features/candidates/testing/handlers';
import { AMINA_SAVED } from '@/features/talent-pool/testing/fixtures';
import { holdsTalentPool } from '@/features/talent-pool/testing/handlers';
import { RECRUITER } from '@/testing/fixtures';
import { renderApp } from '@/testing/render-app';
import { server } from '@/testing/server';

const AT = '/candidates';

const LANGUAGES_IN_URL = encodeURIComponent(JSON.stringify(['ar:native', 'en']));

function results() {
  return within(screen.getByRole('list', { name: 'Matching Candidates' }));
}

describe('the candidate search page', () => {
  it('asks the API nothing until it has been given words to search on', async () => {
    const asked: AskedSearch[] = [];
    server.use(...signedInAs(RECRUITER), ...findsCandidates([AMINA], asked));

    await renderApp(AT);

    expect(
      screen.getByText(
        'Search reaches every Candidate on the platform who has opted into being found. The people you have already saved are in your talent pool.',
      ),
    ).toBeVisible();
    expect(asked).toEqual([]);
  });

  it('refuses to search on words too short for the API to accept', async () => {
    const asked: AskedSearch[] = [];
    server.use(...signedInAs(RECRUITER), ...findsCandidates([AMINA], asked));

    const { user } = await renderApp(AT);

    await user.type(screen.getByLabelText('Who are you looking for?'), 'a');
    await user.click(screen.getByRole('button', { name: 'Search' }));

    expect(
      await screen.findByText('Say who you are looking for, in a couple of words at least.'),
    ).toBeVisible();
    expect(asked).toEqual([]);
  });

  it('sends the words and every hard filter under the name the API knows it by', async () => {
    const asked: AskedSearch[] = [];
    server.use(...signedInAs(RECRUITER), ...findsCandidates([AMINA], asked));

    const { user, router } = await renderApp(AT);

    await user.type(screen.getByLabelText('Who are you looking for?'), 'backend engineer');
    await user.type(screen.getByLabelText('Words that must appear'), 'payments');
    await user.click(screen.getByRole('button', { name: 'Search' }));

    await waitFor(() => expect(asked).toHaveLength(1));
    expect(asked[0]).toMatchObject({
      q: 'backend engineer',
      keywords: 'payments',
      location_key: null,
      language: [],
    });
    expect(router.state.location.search).toEqual({ q: 'backend engineer', keywords: 'payments' });
  });

  it('picks a Location and languages from the platform’s own lists, not from typing', async () => {
    const asked: AskedSearch[] = [];
    server.use(...signedInAs(RECRUITER), ...findsCandidates([AMINA], asked));

    const { user, router } = await renderApp(AT);

    await user.type(screen.getByLabelText('Who are you looking for?'), 'nurse');

    await user.click(screen.getByLabelText('Location'));
    await user.click(await screen.findByRole('option', { name: 'Aleppo' }));

    await user.click(screen.getByLabelText('Languages'));
    await user.click(await screen.findByRole('option', { name: 'Arabic' }));
    await user.click(await screen.findByRole('option', { name: 'English' }));
    await user.keyboard('{Escape}');

    await user.click(await screen.findByRole('button', { name: 'Search' }));

    await waitFor(() => expect(asked).toHaveLength(1));
    expect(asked[0]).toEqual({
      q: 'nurse',
      location_key: 'sy-aleppo',
      language: ['ar', 'en'],
      keywords: null,
    });
    expect(router.state.location.search).toEqual({
      q: 'nurse',
      location: 'sy-aleppo',
      languages: ['ar', 'en'],
    });
  });

  it('asks for a language at a level, and leaves the other one at any level', async () => {
    const asked: AskedSearch[] = [];
    server.use(...signedInAs(RECRUITER), ...findsCandidates([AMINA], asked));

    const { user, router } = await renderApp(AT);

    await user.type(screen.getByLabelText('Who are you looking for?'), 'nurse');

    await user.click(screen.getByLabelText('Languages'));
    await user.click(await screen.findByRole('option', { name: 'Arabic' }));
    await user.click(await screen.findByRole('option', { name: 'English' }));
    await user.keyboard('{Escape}');

    await user.click(await screen.findByRole('combobox', { name: 'Arabic at least' }));
    await user.click(await screen.findByRole('option', { name: 'Native' }));

    await user.click(await screen.findByRole('button', { name: 'Search' }));

    await waitFor(() => expect(asked).toHaveLength(1));
    expect(asked[0]?.language).toEqual(['ar:native', 'en']);
    expect(router.state.location.search).toMatchObject({ languages: ['ar:native', 'en'] });
  });

  it('drops a language from the filter without touching the rest of it', async () => {
    const asked: AskedSearch[] = [];
    server.use(...signedInAs(RECRUITER), ...findsCandidates([AMINA], asked));

    const { user } = await renderApp(`${AT}?q=nurse&languages=${LANGUAGES_IN_URL}`);

    await waitFor(() => expect(asked).toHaveLength(1));
    expect(asked[0]?.language).toEqual(['ar:native', 'en']);

    await user.click(screen.getByRole('button', { name: 'Remove Arabic' }));
    await user.click(screen.getByRole('button', { name: 'Search' }));

    await waitFor(() => expect(asked).toHaveLength(2));
    expect(asked[1]).toMatchObject({ q: 'nurse', language: ['en'] });
  });

  it('renders each match with what it says about the person and the fragment that matched', async () => {
    server.use(...signedInAs(RECRUITER), ...findsCandidates([AMINA, YOUSSEF]));

    await renderApp(`${AT}?q=engineer`);

    expect(await screen.findByText('2 matches, closest first.')).toBeVisible();

    const amina = within(results().getByRole('link', { name: 'Amina Haddad' }));
    expect(
      amina.getByText('Backend engineer, 8 years · Aleppo · Speaks Arabic, English'),
    ).toBeVisible();
    expect(
      amina.getByText('Ran the payment platform at Hand in Hand for four years.'),
    ).toBeVisible();
    expect(amina.getByText('Matched in their experience')).toBeVisible();

    const youssef = within(results().getByRole('link', { name: 'Youssef Nassar' }));
    expect(youssef.getByText('Matched in their skills')).toBeVisible();
  });

  it('says which of the matches the Tenant has already saved', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...findsCandidates([AMINA, YOUSSEF]),
      ...holdsTalentPool([AMINA_SAVED]),
    );

    await renderApp(`${AT}?q=engineer`);

    const amina = within(await results().findByRole('link', { name: 'Amina Haddad' }));
    expect(amina.getByText('In your talent pool')).toBeVisible();

    const youssef = within(results().getByRole('link', { name: 'Youssef Nassar' }));
    expect(youssef.queryByText('In your talent pool')).toBeNull();
  });

  it('reproduces a pasted search from the address alone, filters and all', async () => {
    const asked: AskedSearch[] = [];
    server.use(...signedInAs(RECRUITER), ...findsCandidates([AMINA], asked));

    await renderApp(
      `${AT}?q=nurse&location=sy-aleppo&languages=${LANGUAGES_IN_URL}&keywords=triage`,
    );

    await waitFor(() => expect(asked).toHaveLength(1));
    expect(asked[0]).toEqual({
      q: 'nurse',
      location_key: 'sy-aleppo',
      language: ['ar:native', 'en'],
      keywords: 'triage',
    });
    expect(screen.getByLabelText('Who are you looking for?')).toHaveValue('nurse');
    expect(screen.getByLabelText('Words that must appear')).toHaveValue('triage');
  });

  it('blames the words when a search with nothing else narrowing it finds nobody', async () => {
    server.use(...signedInAs(RECRUITER), ...findsCandidates([]));

    await renderApp(`${AT}?q=quantum%20farrier`);

    expect(
      await screen.findByText(
        'No Searchable Candidate matches those words. Plainer words reach more people.',
      ),
    ).toBeVisible();
    expect(screen.getByRole('link', { name: 'Go to your talent pool' })).toBeVisible();
  });

  it('points at the filters when they are what is narrowing an empty result', async () => {
    server.use(...signedInAs(RECRUITER), ...findsCandidates([]));

    await renderApp(`${AT}?q=nurse&location=sy-aleppo&languages=${LANGUAGES_IN_URL}`);

    expect(
      await screen.findByText('No Searchable Candidate matches those words with those filters.'),
    ).toBeVisible();
  });

  it('clears the filters without losing the words, and searches again', async () => {
    const asked: AskedSearch[] = [];
    server.use(...signedInAs(RECRUITER), ...findsCandidates([], asked));

    const { user, router } = await renderApp(`${AT}?q=nurse&location=sy-aleppo`);

    await waitFor(() => expect(asked).toHaveLength(1));
    await user.click(await screen.findByRole('button', { name: 'Clear filters' }));

    await waitFor(() => expect(router.state.location.search).toEqual({ q: 'nurse' }));
    await waitFor(() => expect(asked).toHaveLength(2));
    expect(asked[1]).toMatchObject({ q: 'nurse', location_key: null });
  });

  it('says in the server’s words why a search could not run, and runs it again on request', async () => {
    server.use(...signedInAs(RECRUITER), ...failsToSearchCandidates(SEARCH_OFFLINE));

    const { user } = await renderApp(`${AT}?q=engineer`);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Global search is not configured on this deployment.',
    );

    server.use(...findsCandidates([AMINA]));
    await user.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await results().findByRole('link', { name: 'Amina Haddad' })).toBeVisible();
  });

  it('opens the Candidate view from a match, carrying the search that found them', async () => {
    server.use(...signedInAs(RECRUITER), ...findsCandidates([AMINA]));

    const { user, router } = await renderApp(`${AT}?q=engineer&location=sy-aleppo`);

    await user.click(await results().findByRole('link', { name: 'Amina Haddad' }));

    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`/candidates/${AMINA.candidate_id}`),
    );
    expect(router.state.location.search).toEqual({ q: 'engineer', location: 'sy-aleppo' });
  });
});
