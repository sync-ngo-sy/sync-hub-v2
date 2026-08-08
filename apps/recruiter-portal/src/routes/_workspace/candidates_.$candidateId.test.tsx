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

function card() {
  return within(screen.getByRole('article', { name: 'Amina Haddad' }));
}

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

    expect(card().getByText('amina.haddad@example.test')).toBeVisible();
    expect(card().getByText('+963 11 555 0142')).toBeVisible();
    expect(
      screen.queryByText(
        'What the platform will show you about this person. Sync never hands over an address or a phone number.',
      ),
    ).toBeNull();
  });

  it('tops the profile with the card of who they are', async () => {
    server.use(...signedInAs(RECRUITER), ...readsCandidate(AMINA_RECORD));

    await renderApp(AT);

    expect(card().getByRole('heading', { level: 1, name: 'Amina Haddad' })).toBeVisible();
    expect(card().getByText('Backend Engineer')).toBeVisible();
    expect(card().getByText('Backend engineer, 8 years')).toBeVisible();
    expect(card().getByText('8 years')).toBeVisible();
    expect(card().getByText('Arabic, English')).toBeVisible();
  });

  it('says what little there is rather than an empty page', async () => {
    server.use(...signedInAs(RECRUITER), ...readsCandidate(BARE_RECORD));

    await renderApp(AT);

    const profile = within(screen.getByRole('region', { name: 'Profile' }));
    expect(
      profile.getByText('This Candidate has filled in nothing beyond the facts above.'),
    ).toBeVisible();
  });

  it('never re-runs a search to find them, however they were reached', async () => {
    const searched: AskedSearch[] = [];
    server.use(
      ...signedInAs(RECRUITER),
      ...findsCandidates([AMINA], searched),
      ...readsCandidate(AMINA_RECORD),
    );

    await renderApp(FOUND_BY);

    expect(searched).toEqual([]);
    expect(screen.getByRole('heading', { level: 1, name: 'Amina Haddad' })).toBeVisible();
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
