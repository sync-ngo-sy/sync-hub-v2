import type { components } from '@sync/api-client';
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { signedInAs } from '@/features/auth/testing/handlers';
import {
  AMINA,
  AMINA_RECORD,
  BARE_RECORD,
  CANDIDATE_OUT_OF_REACH,
} from '@/features/candidates/testing/fixtures';
import {
  type AskedSearch,
  filesCandidateTags,
  findsCandidates,
  keepsCandidateNotes,
  listsCandidateNotes,
  reachesNoCandidate,
  readsCandidate,
} from '@/features/candidates/testing/handlers';
import {
  ARABIC,
  CALLED_HER,
  OPEN_TO_RELOCATION,
  WORKED_WITH_US,
} from '@/features/crm/testing/fixtures';
import { PLACED_AS_MEAL, PLACED_IN_THE_FIELD } from '@/features/placements/testing/fixtures';
import {
  failsToListCandidatePlacements,
  holdsCandidatePlacements,
  listsCandidatePlacements,
} from '@/features/placements/testing/handlers';
import { AMINA_SAVED } from '@/features/talent-pool/testing/fixtures';
import {
  failsToReadTalentPool,
  holdsTalentPool,
  keepsTalentPool,
  refusesTalentPoolChange,
} from '@/features/talent-pool/testing/handlers';
import { RECRUITER, SERVER_FAULT } from '@/testing/fixtures';
import { renderApp } from '@/testing/render-app';
import { server } from '@/testing/server';

const AT = `/candidates/${AMINA.candidate_id}`;
const FOUND_BY = `${AT}?q=backend%20engineer`;

function pool() {
  return within(screen.getByRole('region', { name: 'Talent pool' }));
}

function candidateHeader() {
  const header = screen.getByRole('heading', { level: 1, name: 'Amina Haddad' }).closest('header');
  if (!header) throw new Error('The Candidate heading is not inside its header.');
  return within(header);
}

function candidateCard() {
  return within(screen.getByRole('article', { name: 'Amina Haddad' }));
}

function trail() {
  return within(screen.getByRole('navigation', { name: 'breadcrumb' }));
}

describe('where the Candidate view says the reader came from', () => {
  it('retraces the Talent pool rather than the Candidate search', async () => {
    server.use(...signedInAs(RECRUITER), ...readsCandidate(AMINA_RECORD));

    await renderApp(`${AT}?from=talent-pool`);

    const crumbs = trail();
    expect(await crumbs.findByRole('link', { name: 'Talent pool' })).toHaveAttribute(
      'href',
      '/talent-pool',
    );
    expect(crumbs.queryByRole('link', { name: 'Candidates' })).toBeNull();
    expect(crumbs.getByText('Amina Haddad')).toBeVisible();
  });

  it('retraces the Application it was opened from and names this page the live profile', async () => {
    const application = '00000000-0000-4000-8000-000000000301';
    server.use(...signedInAs(RECRUITER), ...readsCandidate(AMINA_RECORD));

    await renderApp(`${AT}?from=application.${application}`);

    const crumbs = trail();
    expect(await crumbs.findByRole('link', { name: 'Applications' })).toHaveAttribute(
      'href',
      '/applications',
    );
    expect(crumbs.getByRole('link', { name: 'Amina Haddad' })).toHaveAttribute(
      'href',
      `/applications/${application}`,
    );
    expect(crumbs.getByText('Live profile')).toBeVisible();
  });

  it('keeps the tab and the search a Candidates crumb has to reopen', async () => {
    server.use(...signedInAs(RECRUITER), ...readsCandidate(AMINA_RECORD), ...findsCandidates([]));

    await renderApp(FOUND_BY);

    expect(await trail().findByRole('link', { name: 'Candidates' })).toHaveAttribute(
      'href',
      '/candidates?tab=search&q=backend+engineer',
    );
  });

  it('reopens the Filter tab in the order it was sorted into', async () => {
    server.use(...signedInAs(RECRUITER), ...readsCandidate(AMINA_RECORD));

    await renderApp(`${AT}?tab=filter&sort=name&role=nurse`);

    expect(await trail().findByRole('link', { name: 'Candidates' })).toHaveAttribute(
      'href',
      '/candidates?tab=filter&sort=name&role=nurse',
    );
  });

  it('falls back to Candidates when nothing says where the reader came from', async () => {
    server.use(...signedInAs(RECRUITER), ...readsCandidate(AMINA_RECORD));

    await renderApp(AT);

    expect(await trail().findByRole('link', { name: 'Candidates' })).toHaveAttribute(
      'href',
      '/candidates?tab=filter',
    );
  });
});

describe('the Candidate view', () => {
  it('reads the person by id and shows their whole profile', async () => {
    const asked: string[] = [];
    server.use(...signedInAs(RECRUITER), ...readsCandidate(AMINA_RECORD, asked));

    await renderApp(AT);

    expect(asked).toEqual([AMINA.candidate_id]);
    expect(screen.getByRole('heading', { level: 1, name: 'Amina Haddad' })).toBeVisible();
    expect(screen.getByText('Backend engineer, 8 years')).toBeVisible();

    const profile = within(screen.getByRole('region', { name: 'Profile' }));
    expect(profile.getByText('Aleppo')).toBeVisible();
    expect(
      profile.getByText('Builds payment systems for NGOs working across the region.'),
    ).toBeVisible();
    expect(profile.getByText('Payments Lead')).toBeVisible();
    expect(profile.getByText('University of Aleppo')).toBeVisible();
    expect(profile.getByText('PostgreSQL')).toBeVisible();
    expect(profile.getByRole('link', { name: 'Cash transfer ledger' })).toBeVisible();
  });

  it('hands over the email and phone the read carries', async () => {
    server.use(...signedInAs(RECRUITER), ...readsCandidate(AMINA_RECORD));

    await renderApp(AT);

    expect(candidateCard().getByText('amina.haddad@example.test')).toBeVisible();
    expect(candidateCard().getByText('+963 11 555 0142')).toBeVisible();
    expect(
      screen.queryByText(
        'What the platform will show you about this person. Sync Hub never hands over an address or a phone number.',
      ),
    ).toBeNull();
  });

  it('hands over the Links the Candidate claimed, each opening where it says', async () => {
    server.use(...signedInAs(RECRUITER), ...readsCandidate(AMINA_RECORD));

    await renderApp(AT);

    const card = candidateCard();
    expect(card.getByRole('link', { name: 'LinkedIn' })).toHaveAttribute(
      'href',
      'https://www.linkedin.com/in/amina-haddad',
    );
    expect(card.getByRole('link', { name: 'GitHub' })).toHaveAttribute(
      'href',
      'https://github.com/amina-haddad',
    );
    expect(card.getByRole('link', { name: 'amina-haddad.dev' })).toBeVisible();
  });

  it('names the Candidate in the page header and reads them in the Candidate Card below it', async () => {
    server.use(...signedInAs(RECRUITER), ...readsCandidate(AMINA_RECORD));

    await renderApp(AT);

    expect(
      candidateHeader().getByRole('heading', { level: 1, name: 'Amina Haddad' }),
    ).toBeVisible();

    const card = candidateCard();
    expect(card.getByText('AH')).toBeVisible();
    expect(card.getByText('Backend Engineer')).toBeVisible();
    expect(card.getByText('Backend engineer, 8 years')).toBeVisible();
    expect(card.getByText('8 years experience')).toBeVisible();
    expect(card.getByText('Aleppo')).toBeVisible();
    expect(screen.queryByText('Snapshot')).toBeNull();
  });

  it('says what little there is rather than an empty page', async () => {
    server.use(...signedInAs(RECRUITER), ...readsCandidate(BARE_RECORD));

    await renderApp(AT);

    const profile = within(screen.getByRole('region', { name: 'Profile' }));
    expect(
      profile.getByText('This Candidate has filled in nothing beyond the facts above.'),
    ).toBeVisible();
  });

  it('loads the matched fragment on a cold link without using search to identify them', async () => {
    const searched: AskedSearch[] = [];
    server.use(
      ...signedInAs(RECRUITER),
      ...findsCandidates([AMINA], searched),
      ...readsCandidate(AMINA_RECORD),
    );

    await renderApp(FOUND_BY);

    expect(searched).toEqual([
      {
        q: 'backend engineer',
        location_key: null,
        language: [],
        skill: [],
        role: null,
        min_total_experience: null,
        keywords: null,
      },
    ]);
    expect(screen.getByRole('heading', { level: 1, name: 'Amina Haddad' })).toBeVisible();
    expect(screen.getByText('Matched in their experience')).toBeVisible();
  });

  it('keeps the fragment that matched when a search led here', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...findsCandidates([AMINA]),
      ...readsCandidate(AMINA_RECORD),
    );

    const { user } = await renderApp('/candidates?q=backend%20engineer');

    const results = within(await screen.findByRole('list', { name: 'Matching Candidates' }));
    await user.click(results.getByRole('link', { name: 'Amina Haddad' }));

    const profile = within(await screen.findByRole('region', { name: 'Profile' }));
    expect(profile.getByText('Matched in their experience')).toBeVisible();
    expect(
      profile.getByText('Ran the payment platform at Hand in Hand for four years.'),
    ).toBeVisible();
  });

  it('says so when the platform can’t reach that person, rather than inventing a profile', async () => {
    server.use(...signedInAs(RECRUITER), ...reachesNoCandidate());

    await renderApp(FOUND_BY);

    expect(
      screen.getByRole('heading', { level: 1, name: 'This Candidate can’t be shown' }),
    ).toBeVisible();
    expect(screen.getByRole('link', { name: 'Back to candidate search' })).toBeVisible();
  });

  it('says they are not saved, and saves them', async () => {
    const asked: string[] = [];
    server.use(
      ...signedInAs(RECRUITER),
      ...readsCandidate(AMINA_RECORD),
      ...keepsTalentPool([], asked),
    );

    const { user } = await renderApp(FOUND_BY);

    expect(await pool().findByText('Amina Haddad is not in your talent pool.')).toBeVisible();

    await user.click(pool().getByRole('button', { name: 'Save to talent pool' }));

    expect(await pool().findByText('Amina Haddad is in your talent pool.')).toBeVisible();
    expect(pool().getByRole('button', { name: 'Drop from talent pool' })).toBeVisible();
    expect(asked).toEqual([`save ${AMINA.candidate_id}`]);
  });

  it('says they are saved, and drops them', async () => {
    const asked: string[] = [];
    server.use(
      ...signedInAs(RECRUITER),
      ...readsCandidate(AMINA_RECORD),
      ...keepsTalentPool([AMINA_SAVED], asked),
    );

    const { user } = await renderApp(FOUND_BY);

    expect(await pool().findByText('Amina Haddad is in your talent pool.')).toBeVisible();

    await user.click(pool().getByRole('button', { name: 'Drop from talent pool' }));

    expect(await pool().findByText('Amina Haddad is not in your talent pool.')).toBeVisible();
    expect(asked).toEqual([`drop ${AMINA.candidate_id}`]);
  });

  it('puts the server’s reason for refusing beside the button, and changes nothing', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...readsCandidate(AMINA_RECORD),
      ...refusesTalentPoolChange([], CANDIDATE_OUT_OF_REACH),
    );

    const { user } = await renderApp(FOUND_BY);

    await user.click(await pool().findByRole('button', { name: 'Save to talent pool' }));

    expect(await pool().findByText('Talent pool unchanged')).toBeVisible();
    expect(
      pool().getByText('That candidate is not searchable, or no longer exists.'),
    ).toBeVisible();
    expect(pool().getByText('Amina Haddad is not in your talent pool.')).toBeVisible();
  });

  it('fails and retries on its own, leaving the rest of the page standing', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...readsCandidate(AMINA_RECORD),
      ...failsToReadTalentPool(SERVER_FAULT),
    );

    const { user } = await renderApp(FOUND_BY);

    expect(await pool().findByRole('alert')).toHaveTextContent('Something went wrong on our side.');
    expect(pool().queryByRole('button', { name: 'Save to talent pool' })).toBeNull();
    expect(screen.getByRole('heading', { level: 1, name: 'Amina Haddad' })).toBeVisible();
    expect(screen.getByRole('region', { name: 'Profile' })).toBeVisible();

    server.use(...holdsTalentPool([AMINA_SAVED]));
    await user.click(pool().getByRole('button', { name: 'Retry' }));

    expect(await pool().findByText('Amina Haddad is in your talent pool.')).toBeVisible();
  });

  it('writes the team’s memory about the person rather than about an Application', async () => {
    const written: string[] = [];
    server.use(
      ...signedInAs(RECRUITER),
      ...readsCandidate(AMINA_RECORD),
      ...keepsCandidateNotes([], written),
    );

    const { user } = await renderApp(FOUND_BY);

    const notes = within(screen.getByRole('region', { name: 'Notes' }));
    expect(
      notes.getByPlaceholderText('What should your team know about this Candidate?'),
    ).toBeVisible();

    await user.type(
      notes.getByLabelText('New note'),
      'Worth a call before the next payments role.',
    );
    await user.click(notes.getByRole('button', { name: 'Add note' }));

    await waitFor(() => expect(written).toEqual(['Worth a call before the next payments role.']));
    expect(await notes.findByText('Worth a call before the next payments role.')).toBeVisible();
  });

  it('shows the notes the Tenant already keeps on the person', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...readsCandidate(AMINA_RECORD),
      ...listsCandidateNotes([CALLED_HER]),
    );

    await renderApp(FOUND_BY);

    const notes = within(screen.getByRole('region', { name: 'Notes' }));
    expect(
      await notes.findByText('Called her — she can start in October, and she has her own vehicle.'),
    ).toBeVisible();
  });

  it('offers only the Tags a Tenant may put on a Candidate, and files them under one', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...readsCandidate(AMINA_RECORD),
      ...filesCandidateTags({ vocabulary: [ARABIC, OPEN_TO_RELOCATION, WORKED_WITH_US] }),
    );

    const { user } = await renderApp(FOUND_BY);

    const tags = within(screen.getByRole('region', { name: 'Tags' }));
    expect(
      tags.getByText('How your team files this Candidate. Your Tags, and yours alone.'),
    ).toBeVisible();

    await user.click(tags.getByRole('button', { name: 'Add a Tag' }));
    const vocabulary = within(screen.getByRole('list', { name: 'Tag vocabulary' }));

    expect(vocabulary.getAllByRole('button').map((choice) => choice.textContent)).toEqual([
      'Open to relocation',
      'Worked with us before',
    ]);

    await user.click(vocabulary.getByRole('button', { name: 'Open to relocation' }));

    const filed = within(await screen.findByRole('list', { name: 'Tags on this Candidate' }));
    expect(filed.getByText('Open to relocation')).toBeVisible();
  });

  it('mints a candidate-scoped word when the Tenant does not have it yet', async () => {
    const created: components['schemas']['NewTag'][] = [];
    server.use(
      ...signedInAs(RECRUITER),
      ...readsCandidate(AMINA_RECORD),
      ...filesCandidateTags({ vocabulary: [OPEN_TO_RELOCATION] }, created),
    );

    const { user } = await renderApp(FOUND_BY);

    const tags = within(screen.getByRole('region', { name: 'Tags' }));
    await user.click(tags.getByRole('button', { name: 'Add a Tag' }));
    await user.type(screen.getByLabelText('Find or create a Tag'), 'Speaks Kurdish');
    await user.click(screen.getByRole('button', { name: 'Create “Speaks Kurdish”' }));

    await waitFor(() => expect(created).toEqual([{ name: 'Speaks Kurdish', scope: 'candidate' }]));
  });
});

describe('the Placements card beside Talent pool, Tags and Notes', () => {
  function placements() {
    return within(screen.getByRole('region', { name: 'Placements' }));
  }

  it('names the Job and the day the work started, for each Placement of this Tenant', async () => {
    const asked: string[] = [];
    server.use(
      ...signedInAs(RECRUITER),
      ...readsCandidate(AMINA_RECORD),
      ...listsCandidatePlacements([PLACED_AS_MEAL, PLACED_IN_THE_FIELD], asked),
    );

    await renderApp(AT);

    expect(await screen.findByRole('region', { name: 'Placements' })).toBeVisible();
    const placed = placements().getAllByRole('listitem');
    expect(placed).toHaveLength(2);
    expect(within(placed[0] as HTMLElement).getByText('MEAL Officer')).toBeVisible();
    expect(within(placed[0] as HTMLElement).getByText('September 1, 2026')).toBeVisible();
    expect(within(placed[1] as HTMLElement).getByText('Field Coordinator')).toBeVisible();
    expect(within(placed[1] as HTMLElement).getByText('March 1, 2026')).toBeVisible();
    expect(asked).toEqual([AMINA.candidate_id]);
  });

  it('opens the Job it names', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...readsCandidate(AMINA_RECORD),
      ...listsCandidatePlacements([PLACED_AS_MEAL]),
    );

    await renderApp(AT);

    expect(await placements().findByRole('link', { name: 'MEAL Officer' })).toHaveAttribute(
      'href',
      `/jobs/${PLACED_AS_MEAL.job.id}`,
    );
  });

  it('shows nothing at all for a Candidate this Tenant has not placed', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...readsCandidate(AMINA_RECORD),
      ...listsCandidatePlacements([]),
    );

    await renderApp(AT);

    expect(await screen.findByRole('region', { name: 'Talent pool' })).toBeVisible();
    expect(screen.queryByRole('region', { name: 'Placements' })).toBeNull();
  });

  it('promises no card while the reading is still on the wire', async () => {
    const held = holdsCandidatePlacements([PLACED_AS_MEAL]);
    server.use(...signedInAs(RECRUITER), ...readsCandidate(AMINA_RECORD), ...held.handlers);

    await renderApp(AT);

    expect(await screen.findByRole('region', { name: 'Talent pool' })).toBeVisible();
    expect(screen.queryByRole('region', { name: 'Placements' })).toBeNull();

    held.arrive();

    expect(await screen.findByRole('region', { name: 'Placements' })).toBeVisible();
  });

  it('says a refused reading is refused rather than letting it read as unplaced', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...readsCandidate(AMINA_RECORD),
      ...failsToListCandidatePlacements(SERVER_FAULT),
    );

    await renderApp(AT);

    const refused = within(await screen.findByRole('region', { name: 'Placements' }));
    expect(refused.getByRole('alert')).toHaveTextContent('Something went wrong on our side.');
    expect(refused.queryByRole('list')).toBeNull();
  });
});
