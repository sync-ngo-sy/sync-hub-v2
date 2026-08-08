import type { components } from '@sync/api-client';
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { signedInAs } from '@/features/auth/testing/handlers';
import { AMINA, CANDIDATE_OUT_OF_REACH, YOUSSEF } from '@/features/candidates/testing/fixtures';
import {
  type AskedSearch,
  filesCandidateTags,
  findsCandidates,
  keepsCandidateNotes,
  listsCandidateNotes,
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

describe('the Candidate view', () => {
  it('shows the person the search found, and the fragment that found them', async () => {
    server.use(...signedInAs(RECRUITER), ...findsCandidates([AMINA]));

    await renderApp(FOUND_BY);

    expect(screen.getByRole('heading', { level: 1, name: 'Amina Haddad' })).toBeVisible();
    expect(screen.getByText('Backend engineer, 8 years · Aleppo')).toBeVisible();

    const profile = within(screen.getByRole('region', { name: 'Profile' }));
    expect(
      profile.getByText('Builds payment systems for NGOs working across the region.'),
    ).toBeVisible();
    expect(
      profile.getByText('Ran the payment platform at Hand in Hand for four years.'),
    ).toBeVisible();
    expect(profile.getByText('Matched in their experience')).toBeVisible();
  });

  it('says plainly that the platform hands over no way to contact them', async () => {
    server.use(...signedInAs(RECRUITER), ...findsCandidates([AMINA]));

    await renderApp(FOUND_BY);

    expect(
      screen.getByText(
        'What the platform will show you about this person. Sync never hands over an address or a phone number.',
      ),
    ).toBeVisible();
  });

  it('re-runs the search in the address, so a pasted link opens the same person', async () => {
    const asked: AskedSearch[] = [];
    server.use(...signedInAs(RECRUITER), ...findsCandidates([YOUSSEF, AMINA], asked));

    await renderApp(FOUND_BY);

    expect(asked).toHaveLength(1);
    expect(asked[0]).toMatchObject({ q: 'backend engineer' });
    expect(screen.getByRole('heading', { level: 1, name: 'Amina Haddad' })).toBeVisible();
  });

  it('reads them off the talent pool when no search led here', async () => {
    const asked: AskedSearch[] = [];
    server.use(
      ...signedInAs(RECRUITER),
      ...findsCandidates([AMINA], asked),
      ...holdsTalentPool([AMINA_SAVED]),
    );

    await renderApp(AT);

    expect(asked).toEqual([]);
    expect(screen.getByRole('heading', { level: 1, name: 'Amina Haddad' })).toBeVisible();
    expect(screen.getByText('Backend engineer, 8 years · Aleppo')).toBeVisible();
  });

  it('says so when neither the search nor the pool has them', async () => {
    server.use(...signedInAs(RECRUITER), ...findsCandidates([YOUSSEF]));

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
      ...findsCandidates([AMINA]),
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
      ...findsCandidates([AMINA]),
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
      ...findsCandidates([AMINA]),
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
      ...findsCandidates([AMINA]),
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
      ...findsCandidates([AMINA]),
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
      ...findsCandidates([AMINA]),
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
      ...findsCandidates([AMINA]),
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
      ...findsCandidates([AMINA]),
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
