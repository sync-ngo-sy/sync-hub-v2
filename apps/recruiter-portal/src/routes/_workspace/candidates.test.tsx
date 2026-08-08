import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { signedInAs } from '@/features/auth/testing/handlers';
import {
  AMINA,
  AMINA_RECORD,
  LISTED_AMINA,
  LISTED_YOUSSEF,
  SEARCH_OFFLINE,
  YOUSSEF,
} from '@/features/candidates/testing/fixtures';
import {
  type AskedDirectory,
  type AskedSearch,
  failsToSearchCandidates,
  findsCandidates,
  listsDirectoryCandidates,
  readsCandidate,
} from '@/features/candidates/testing/handlers';
import { AMINA_SAVED } from '@/features/talent-pool/testing/fixtures';
import { holdsTalentPool } from '@/features/talent-pool/testing/handlers';
import { RECRUITER } from '@/testing/fixtures';
import { renderApp } from '@/testing/render-app';
import { server } from '@/testing/server';

const AT = '/candidates';

const SEARCHING = `${AT}?tab=search`;

const LANGUAGES_IN_URL = encodeURIComponent(JSON.stringify(['ar:native', 'en']));

const AI_HINT =
  'These results are ranked by AI relevance and may be imperfect. Use the Filter tab when you need exact matching.';

function results() {
  return within(screen.getByRole('list', { name: 'Matching Candidates' }));
}

function directory() {
  return within(screen.getByRole('table', { name: 'Searchable Candidates' }));
}

function rowNames() {
  return directory()
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).getAllByRole('cell')[0]?.textContent ?? '');
}

describe('the two ways of finding a Candidate', () => {
  it('opens on the Filter tab and lists the directory without being asked anything', async () => {
    const asked: AskedDirectory[] = [];
    server.use(
      ...signedInAs(RECRUITER),
      ...listsDirectoryCandidates([LISTED_AMINA, LISTED_YOUSSEF], asked),
    );

    await renderApp(AT);

    expect(await screen.findByRole('tab', { name: 'Filter', selected: true })).toBeVisible();
    expect(screen.getByRole('tab', { name: 'AI Search', selected: false })).toBeVisible();
    expect(await directory().findByText('Amina Haddad')).toBeVisible();
    await waitFor(() => expect(asked).toHaveLength(1));
    expect(asked[0]?.sort).toBe('newest');
  });

  it('offers no box to write words in on the Filter tab', async () => {
    server.use(...signedInAs(RECRUITER), ...listsDirectoryCandidates([LISTED_AMINA]));

    await renderApp(AT);

    expect(await screen.findByRole('form', { name: 'Candidate filters' })).toBeVisible();
    expect(screen.queryByLabelText('Who are you looking for?')).toBeNull();
    expect(screen.queryByLabelText('Words that must appear')).toBeNull();
  });

  it('moves to the AI Search tab and says so in the address, so a reload stays there', async () => {
    server.use(...signedInAs(RECRUITER), ...findsCandidates([AMINA]));

    const { user, router } = await renderApp(AT);

    await user.click(await screen.findByRole('tab', { name: 'AI Search' }));

    await waitFor(() => expect(router.state.location.search).toMatchObject({ tab: 'search' }));
    expect(screen.getByLabelText('Who are you looking for?')).toBeVisible();
    expect(screen.queryByRole('table', { name: 'Searchable Candidates' })).toBeNull();
  });

  it('reopens the tab the address names rather than the one it defaults to', async () => {
    server.use(...signedInAs(RECRUITER), ...findsCandidates([AMINA]));

    await renderApp(SEARCHING);

    expect(await screen.findByRole('tab', { name: 'AI Search', selected: true })).toBeVisible();
    expect(screen.getByRole('tab', { name: 'Filter', selected: false })).toBeVisible();
  });

  it('opens a link written before the tabs existed on the search it was copied from', async () => {
    server.use(...signedInAs(RECRUITER), ...findsCandidates([AMINA]));

    await renderApp(`${AT}?q=engineer`);

    expect(await screen.findByRole('tab', { name: 'AI Search', selected: true })).toBeVisible();
    expect(screen.getByLabelText('Who are you looking for?')).toHaveValue('engineer');
  });

  it('says on the AI Search tab that the ranking is a machine’s reading and may be wrong', async () => {
    server.use(...signedInAs(RECRUITER), ...findsCandidates([AMINA]));

    await renderApp(SEARCHING);

    expect(await screen.findByText(AI_HINT)).toBeVisible();
  });

  it('keeps the hint there once the results have arrived', async () => {
    server.use(...signedInAs(RECRUITER), ...findsCandidates([AMINA, YOUSSEF]));

    await renderApp(`${SEARCHING}&q=engineer`);

    expect(await results().findByRole('link', { name: 'Amina Haddad' })).toBeVisible();
    expect(screen.getByText(AI_HINT)).toBeVisible();
  });

  it('never says it on the Filter tab, whose answers are facts rather than a ranking', async () => {
    server.use(...signedInAs(RECRUITER), ...listsDirectoryCandidates([LISTED_AMINA]));

    await renderApp(AT);

    expect(await directory().findByText('Amina Haddad')).toBeVisible();
    expect(screen.queryByText(AI_HINT)).toBeNull();
  });
});

describe('the Filter tab', () => {
  it('sends each of the four filters under the name the API knows it by', async () => {
    const asked: AskedDirectory[] = [];
    server.use(...signedInAs(RECRUITER), ...listsDirectoryCandidates([LISTED_AMINA], asked));

    const { user, router } = await renderApp(AT);

    await user.click(await screen.findByLabelText('Skills'));
    await user.click(await screen.findByRole('option', { name: 'Python' }));
    await user.keyboard('{Escape}');

    await user.click(screen.getByLabelText('Role'));
    await user.click(await screen.findByRole('option', { name: 'Backend Engineer' }));

    await user.type(screen.getByLabelText('Years of experience'), '5');

    await user.click(screen.getByLabelText('Languages'));
    await user.click(await screen.findByRole('option', { name: 'Arabic' }));
    await user.keyboard('{Escape}');

    await user.click(screen.getByRole('button', { name: 'Apply filters' }));

    await waitFor(() => expect(asked.length).toBeGreaterThan(1));
    expect(asked.at(-1)).toMatchObject({
      skill: ['Python'],
      role: 'backend-engineer',
      min_total_experience: '5',
      language: ['ar'],
    });
    expect(router.state.location.search).toMatchObject({
      skills: ['Python'],
      role: 'backend-engineer',
      experience: 5,
      languages: ['ar'],
    });
  });

  it('reproduces a pasted directory address, filters and order and all', async () => {
    const asked: AskedDirectory[] = [];
    server.use(...signedInAs(RECRUITER), ...listsDirectoryCandidates([LISTED_AMINA], asked));

    await renderApp(
      `${AT}?tab=filter&sort=name&role=backend-engineer&experience=5&skills=${encodeURIComponent(
        JSON.stringify(['Python']),
      )}`,
    );

    await waitFor(() => expect(asked).toHaveLength(1));
    expect(asked[0]).toEqual({
      sort: 'name',
      location_key: null,
      language: [],
      skill: ['Python'],
      role: 'backend-engineer',
      min_total_experience: '5',
    });
  });

  it('asks the API for a new order when a column is sorted, and never re-sorts in the browser', async () => {
    const asked: AskedDirectory[] = [];
    server.use(
      ...signedInAs(RECRUITER),
      ...listsDirectoryCandidates([LISTED_AMINA, LISTED_YOUSSEF], asked, {
        name: [LISTED_AMINA, LISTED_YOUSSEF],
        name_reversed: [LISTED_YOUSSEF, LISTED_AMINA],
      }),
    );

    const { user, router } = await renderApp(AT);

    await user.click(await directory().findByRole('button', { name: 'Name' }));

    await waitFor(() => expect(router.state.location.search).toMatchObject({ sort: 'name' }));
    await waitFor(() => expect(rowNames()[0]).toContain('Amina Haddad'));

    await user.click(directory().getByRole('button', { name: 'Name' }));

    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({ sort: 'name_reversed' }),
    );
    await waitFor(() => expect(rowNames()[0]).toContain('Youssef Nassar'));
    expect(asked.map((each) => each.sort)).toEqual(['newest', 'name', 'name_reversed']);
  });

  it('says which column is sorted and which way, for a reader who cannot see the arrow', async () => {
    server.use(...signedInAs(RECRUITER), ...listsDirectoryCandidates([LISTED_AMINA]));

    await renderApp(`${AT}?sort=most_experience`);

    const headers = await directory().findAllByRole('columnheader');
    const experience = headers.find((header) => header.textContent?.includes('Experience'));
    expect(experience).toHaveAttribute('aria-sort', 'descending');
    expect(headers[0]).not.toHaveAttribute('aria-sort');
  });

  it('sorts on nothing the API does not offer, and falls back to the newest', async () => {
    const asked: AskedDirectory[] = [];
    server.use(...signedInAs(RECRUITER), ...listsDirectoryCandidates([LISTED_AMINA], asked));

    await renderApp(`${AT}?sort=cheapest`);

    await waitFor(() => expect(asked).toHaveLength(1));
    expect(asked[0]?.sort).toBe('newest');
  });

  it('shows what the directory says about each person', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...listsDirectoryCandidates([LISTED_AMINA]),
      ...holdsTalentPool([AMINA_SAVED]),
    );

    await renderApp(AT);

    const row = (await directory().findAllByRole('row'))[1];
    expect(row).toBeDefined();
    const amina = within(row as HTMLElement);
    expect(amina.getByText('Amina Haddad')).toBeVisible();
    expect(amina.getByText('Backend Engineer')).toBeVisible();
    expect(amina.getByText('8 years')).toBeVisible();
    expect(amina.getByText('Arabic, English')).toBeVisible();
    expect(amina.getByText('Aleppo')).toBeVisible();
  });

  it('opens the Candidate view from a row, carrying the filters that found them', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...listsDirectoryCandidates([LISTED_AMINA]),
      ...readsCandidate(AMINA_RECORD),
    );

    const { user, router } = await renderApp(`${AT}?role=backend-engineer`);

    await user.click(await directory().findByRole('button', { name: 'Open Amina Haddad' }));

    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`/candidates/${LISTED_AMINA.candidate_id}`),
    );
    expect(router.state.location.search).toEqual({ role: 'backend-engineer' });
    expect(await screen.findByRole('heading', { name: 'Amina Haddad' })).toBeVisible();
  });

  it('offers to loosen the filters when they are what leaves the directory empty', async () => {
    server.use(...signedInAs(RECRUITER), ...listsDirectoryCandidates([]));

    const { user, router } = await renderApp(`${AT}?role=backend-engineer&experience=5`);

    expect(
      await screen.findByText('No Searchable Candidate matches all of those filters.'),
    ).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Clear filters' }));

    await waitFor(() => expect(router.state.location.search).toEqual({ tab: 'filter' }));
  });
});

describe('the AI Search tab', () => {
  it('asks the API nothing until it has been given words to search on', async () => {
    const asked: AskedSearch[] = [];
    server.use(...signedInAs(RECRUITER), ...findsCandidates([AMINA], asked));

    await renderApp(SEARCHING);

    expect(
      await screen.findByText(
        'Search reaches every Candidate on the platform who has opted into being found. The people you have already saved are in your talent pool.',
      ),
    ).toBeVisible();
    expect(asked).toEqual([]);
  });

  it('refuses to search on words too short for the API to accept', async () => {
    const asked: AskedSearch[] = [];
    server.use(...signedInAs(RECRUITER), ...findsCandidates([AMINA], asked));

    const { user } = await renderApp(SEARCHING);

    await user.type(await screen.findByLabelText('Who are you looking for?'), 'a');
    await user.click(screen.getByRole('button', { name: 'Search' }));

    expect(
      await screen.findByText('Say who you are looking for, in a couple of words at least.'),
    ).toBeVisible();
    expect(asked).toEqual([]);
  });

  it('sends the words and every hard filter under the name the API knows it by', async () => {
    const asked: AskedSearch[] = [];
    server.use(...signedInAs(RECRUITER), ...findsCandidates([AMINA], asked));

    const { user, router } = await renderApp(SEARCHING);

    await user.type(await screen.findByLabelText('Who are you looking for?'), 'backend engineer');
    await user.type(screen.getByLabelText('Words that must appear'), 'payments');
    await user.click(screen.getByRole('button', { name: 'Search' }));

    await waitFor(() => expect(asked).toHaveLength(1));
    expect(asked[0]).toMatchObject({
      q: 'backend engineer',
      keywords: 'payments',
      location_key: null,
      language: [],
      skill: [],
    });
    expect(router.state.location.search).toMatchObject({
      tab: 'search',
      q: 'backend engineer',
      keywords: 'payments',
    });
  });

  it('offers the same four filters the Filter tab does, and narrows the ranking with them', async () => {
    const asked: AskedSearch[] = [];
    server.use(...signedInAs(RECRUITER), ...findsCandidates([AMINA], asked));

    const { user } = await renderApp(SEARCHING);

    await user.type(await screen.findByLabelText('Who are you looking for?'), 'nurse');

    await user.click(screen.getByLabelText('Skills'));
    await user.click(await screen.findByRole('option', { name: 'Python' }));
    await user.keyboard('{Escape}');

    await user.click(screen.getByLabelText('Role'));
    await user.click(await screen.findByRole('option', { name: 'Nurse' }));

    await user.type(screen.getByLabelText('Years of experience'), '3');

    await user.click(screen.getByRole('button', { name: 'Search' }));

    await waitFor(() => expect(asked).toHaveLength(1));
    expect(asked[0]).toMatchObject({
      q: 'nurse',
      skill: ['Python'],
      role: 'nurse',
      min_total_experience: '3',
    });
  });

  it('offers no column to sort, because closeness is the order and nothing else is', async () => {
    server.use(...signedInAs(RECRUITER), ...findsCandidates([AMINA, YOUSSEF]));

    await renderApp(`${SEARCHING}&q=engineer`);

    expect(await results().findByRole('link', { name: 'Amina Haddad' })).toBeVisible();
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.queryByRole('columnheader')).toBeNull();
  });

  it('picks a Location and languages from the platform’s own lists, not from typing', async () => {
    const asked: AskedSearch[] = [];
    server.use(...signedInAs(RECRUITER), ...findsCandidates([AMINA], asked));

    const { user, router } = await renderApp(SEARCHING);

    await user.type(await screen.findByLabelText('Who are you looking for?'), 'nurse');

    await user.click(screen.getByLabelText('Location'));
    await user.click(await screen.findByRole('option', { name: 'Aleppo' }));

    await user.click(screen.getByLabelText('Languages'));
    await user.click(await screen.findByRole('option', { name: 'Arabic' }));
    await user.click(await screen.findByRole('option', { name: 'English' }));
    await user.keyboard('{Escape}');

    await user.click(await screen.findByRole('button', { name: 'Search' }));

    await waitFor(() => expect(asked).toHaveLength(1));
    expect(asked[0]).toMatchObject({
      q: 'nurse',
      location_key: 'sy-aleppo',
      language: ['ar', 'en'],
      keywords: null,
    });
    expect(router.state.location.search).toMatchObject({
      q: 'nurse',
      location: 'sy-aleppo',
      languages: ['ar', 'en'],
    });
  });

  it('asks for a language at a level, and leaves the other one at any level', async () => {
    const asked: AskedSearch[] = [];
    server.use(...signedInAs(RECRUITER), ...findsCandidates([AMINA], asked));

    const { user, router } = await renderApp(SEARCHING);

    await user.type(await screen.findByLabelText('Who are you looking for?'), 'nurse');

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

    const { user } = await renderApp(`${SEARCHING}&q=nurse&languages=${LANGUAGES_IN_URL}`);

    await waitFor(() => expect(asked).toHaveLength(1));
    expect(asked[0]?.language).toEqual(['ar:native', 'en']);

    await user.click(await screen.findByRole('button', { name: 'Remove Arabic' }));
    await user.click(screen.getByRole('button', { name: 'Search' }));

    await waitFor(() => expect(asked).toHaveLength(2));
    expect(asked[1]).toMatchObject({ q: 'nurse', language: ['en'] });
  });

  it('renders each match with what it says about the person and the fragment that matched', async () => {
    server.use(...signedInAs(RECRUITER), ...findsCandidates([AMINA, YOUSSEF]));

    await renderApp(`${SEARCHING}&q=engineer`);

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

    await renderApp(`${SEARCHING}&q=engineer`);

    const amina = within(await results().findByRole('link', { name: 'Amina Haddad' }));
    expect(amina.getByText('In your talent pool')).toBeVisible();

    const youssef = within(results().getByRole('link', { name: 'Youssef Nassar' }));
    expect(youssef.queryByText('In your talent pool')).toBeNull();
  });

  it('reproduces a pasted search from the address alone, filters and all', async () => {
    const asked: AskedSearch[] = [];
    server.use(...signedInAs(RECRUITER), ...findsCandidates([AMINA], asked));

    await renderApp(
      `${SEARCHING}&q=nurse&location=sy-aleppo&languages=${LANGUAGES_IN_URL}&keywords=triage`,
    );

    await waitFor(() => expect(asked).toHaveLength(1));
    expect(asked[0]).toMatchObject({
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

    await renderApp(`${SEARCHING}&q=quantum%20farrier`);

    expect(
      await screen.findByText(
        'No Searchable Candidate matches those words. Plainer words reach more people.',
      ),
    ).toBeVisible();
    expect(screen.getByRole('link', { name: 'Go to your talent pool' })).toBeVisible();
  });

  it('points at the filters when they are what is narrowing an empty result', async () => {
    server.use(...signedInAs(RECRUITER), ...findsCandidates([]));

    await renderApp(`${SEARCHING}&q=nurse&location=sy-aleppo&languages=${LANGUAGES_IN_URL}`);

    expect(
      await screen.findByText('No Searchable Candidate matches those words with those filters.'),
    ).toBeVisible();
  });

  it('clears the filters without losing the words, and searches again', async () => {
    const asked: AskedSearch[] = [];
    server.use(...signedInAs(RECRUITER), ...findsCandidates([], asked));

    const { user, router } = await renderApp(`${SEARCHING}&q=nurse&location=sy-aleppo`);

    await waitFor(() => expect(asked).toHaveLength(1));
    await user.click(await screen.findByRole('button', { name: 'Clear filters' }));

    await waitFor(() =>
      expect(router.state.location.search).toEqual({ tab: 'search', q: 'nurse' }),
    );
    await waitFor(() => expect(asked).toHaveLength(2));
    expect(asked[1]).toMatchObject({ q: 'nurse', location_key: null });
  });

  it('says in the server’s words why a search could not run, and runs it again on request', async () => {
    server.use(...signedInAs(RECRUITER), ...failsToSearchCandidates(SEARCH_OFFLINE));

    const { user } = await renderApp(`${SEARCHING}&q=engineer`);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Global search is not configured on this deployment.',
    );

    server.use(...findsCandidates([AMINA]));
    await user.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await results().findByRole('link', { name: 'Amina Haddad' })).toBeVisible();
  });

  it('opens the Candidate view from a match, carrying the search that found them', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...findsCandidates([AMINA]),
      ...readsCandidate(AMINA_RECORD),
    );

    const { user, router } = await renderApp(`${SEARCHING}&q=engineer&location=sy-aleppo`);

    await user.click(await results().findByRole('link', { name: 'Amina Haddad' }));

    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`/candidates/${AMINA.candidate_id}`),
    );
    expect(router.state.location.search).toEqual({ q: 'engineer', location: 'sy-aleppo' });
    expect(await screen.findByRole('article', { name: 'Amina Haddad' })).toBeVisible();
  });
});
