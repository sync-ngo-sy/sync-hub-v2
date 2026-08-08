import type { components } from '@sync/api-client';
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AMAL_REVIEW } from '@/features/applications/testing/fixtures';
import {
  failsToListApplicationTags,
  filesApplicationTags,
  getsApplication,
  listsApplicationTags,
  refusesApplicationTag,
  refusesTenantTagCreation,
} from '@/features/applications/testing/handlers';
import { signedInAs } from '@/features/auth/testing/handlers';
import {
  ARABIC,
  HAS_A_LICENCE,
  OPEN_TO_RELOCATION,
  RELOCATING,
  TAG_NAME_TAKEN,
  TAG_WRONG_SCOPE,
} from '@/features/crm/testing/fixtures';
import { RECRUITER, SERVER_FAULT } from '@/testing/fixtures';
import { renderApp } from '@/testing/render-app';
import { server } from '@/testing/server';

const REVIEW = AMAL_REVIEW;
const AT = `/applications/${REVIEW.id}`;
const VOCABULARY = [ARABIC, HAS_A_LICENCE, RELOCATING];

async function openTags() {
  const rendered = await renderApp(AT);
  const tags = await screen.findByRole('region', { name: 'Tags' });
  return { ...rendered, tags: within(tags) };
}

function filedUnder() {
  return within(screen.getByRole('list', { name: 'Tags on this Application' }));
}

function vocabulary() {
  return within(screen.getByRole('list', { name: 'Tag vocabulary' }));
}

describe('the Tags on the Application review page', () => {
  it('says the filing is the Tenant’s own', async () => {
    server.use(...signedInAs(RECRUITER), ...getsApplication(REVIEW));

    const { tags } = await openTags();

    expect(
      tags.getByText('How your team files this Application. Your Tags, and yours alone.'),
    ).toBeVisible();
  });

  it('shows what this Application is already filed under', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...getsApplication(REVIEW),
      ...listsApplicationTags([ARABIC, HAS_A_LICENCE], VOCABULARY),
    );

    await openTags();

    const filed = filedUnder();
    expect(await filed.findByText('Arabic')).toBeVisible();
    expect(filed.getByText('Has a driving licence')).toBeVisible();
    expect(filed.queryByText('Relocating')).toBeNull();
  });

  it('renders every Tag in the one same soft pill, whatever the word says', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...getsApplication(REVIEW),
      ...listsApplicationTags([ARABIC, HAS_A_LICENCE, RELOCATING], VOCABULARY),
    );

    await openTags();

    const filed = filedUnder();
    await filed.findByText('Arabic');
    const pills = ['Arabic', 'Has a driving licence', 'Relocating'].map((name) =>
      filed.getByText(name),
    );

    expect(new Set(pills.map((pill) => pill.className)).size).toBe(1);
    for (const pill of pills) {
      expect(pill).toHaveClass('bg-secondary');
    }
  });

  it('says so plainly when the Application is filed under nothing', async () => {
    server.use(...signedInAs(RECRUITER), ...getsApplication(REVIEW));

    const { tags } = await openTags();

    expect(
      tags.getByText(
        'Not filed under anything yet. A Tag here is how you find this Application again.',
      ),
    ).toBeVisible();
  });

  it('offers the whole vocabulary, marking what is already on', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...getsApplication(REVIEW),
      ...listsApplicationTags([ARABIC], VOCABULARY),
    );

    const { user, tags } = await openTags();

    await user.click(tags.getByRole('button', { name: 'Add a Tag' }));

    const offered = vocabulary().getAllByRole('button');
    expect(offered.map((choice) => choice.textContent)).toEqual([
      'Arabic',
      'Has a driving licence',
      'Relocating',
    ]);
    expect(offered[0]).toHaveAttribute('aria-pressed', 'true');
    expect(offered[1]).toHaveAttribute('aria-pressed', 'false');
  });

  it('offers only the Tags a Tenant may put on an Application', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...getsApplication(REVIEW),
      ...filesApplicationTags({ vocabulary: [ARABIC, OPEN_TO_RELOCATION] }),
    );

    const { user, tags } = await openTags();

    await user.click(tags.getByRole('button', { name: 'Add a Tag' }));

    expect(vocabulary().getByRole('button', { name: 'Arabic' })).toBeVisible();
    expect(vocabulary().queryByRole('button', { name: 'Open to relocation' })).toBeNull();
  });

  it('narrows the vocabulary to what the Recruiter is looking for', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...getsApplication(REVIEW),
      ...filesApplicationTags({ vocabulary: VOCABULARY }),
    );

    const { user, tags } = await openTags();

    await user.click(tags.getByRole('button', { name: 'Add a Tag' }));
    await user.type(screen.getByLabelText('Find or create a Tag'), 'licence');

    expect(
      vocabulary()
        .getAllByRole('button')
        .map((choice) => choice.textContent),
    ).toEqual(['Has a driving licence']);
  });

  it('puts one of the Tenant’s Tags on the Application', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...getsApplication(REVIEW),
      ...filesApplicationTags({ vocabulary: VOCABULARY }),
    );

    const { user, tags } = await openTags();

    await user.click(tags.getByRole('button', { name: 'Add a Tag' }));
    await user.click(vocabulary().getByRole('button', { name: 'Relocating' }));

    expect(await filedUnder().findByText('Relocating')).toBeVisible();
    await waitFor(() =>
      expect(vocabulary().getByRole('button', { name: 'Relocating' })).toHaveAttribute(
        'aria-pressed',
        'true',
      ),
    );
  });

  it('takes a Tag off from the Tag itself', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...getsApplication(REVIEW),
      ...filesApplicationTags({ vocabulary: VOCABULARY, on: [ARABIC, RELOCATING] }),
    );

    const { user } = await openTags();

    await filedUnder().findByText('Arabic');
    await user.click(filedUnder().getByRole('button', { name: 'Take off Arabic' }));

    await waitFor(() => expect(filedUnder().queryByText('Arabic')).toBeNull());
    expect(filedUnder().getByText('Relocating')).toBeVisible();
  });

  it('takes a Tag off from the picker that put it on', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...getsApplication(REVIEW),
      ...filesApplicationTags({ vocabulary: VOCABULARY, on: [ARABIC] }),
    );

    const { user, tags } = await openTags();

    await filedUnder().findByText('Arabic');
    await user.click(tags.getByRole('button', { name: 'Add a Tag' }));
    await user.click(vocabulary().getByRole('button', { name: 'Arabic' }));

    await waitFor(() =>
      expect(vocabulary().getByRole('button', { name: 'Arabic' })).toHaveAttribute(
        'aria-pressed',
        'false',
      ),
    );
    expect(screen.queryByRole('list', { name: 'Tags on this Application' })).toBeNull();
  });

  it('creates a Tag the Tenant does not have yet and files the Application under it', async () => {
    const created: components['schemas']['NewTag'][] = [];
    server.use(
      ...signedInAs(RECRUITER),
      ...getsApplication(REVIEW),
      ...filesApplicationTags({ vocabulary: VOCABULARY }, created),
    );

    const { user, tags } = await openTags();

    await user.click(tags.getByRole('button', { name: 'Add a Tag' }));
    await user.type(screen.getByLabelText('Find or create a Tag'), 'Kurdish');
    await user.click(screen.getByRole('button', { name: 'Create “Kurdish”' }));

    expect(await filedUnder().findByText('Kurdish')).toBeVisible();
    expect(created).toEqual([{ name: 'Kurdish', scope: 'application' }]);
    await waitFor(() =>
      expect(vocabulary().getByRole('button', { name: 'Kurdish' })).toHaveAttribute(
        'aria-pressed',
        'true',
      ),
    );
  });

  it('does not offer to create a word the Tenant already has', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...getsApplication(REVIEW),
      ...filesApplicationTags({ vocabulary: VOCABULARY }),
    );

    const { user, tags } = await openTags();

    await user.click(tags.getByRole('button', { name: 'Add a Tag' }));
    await user.type(screen.getByLabelText('Find or create a Tag'), 'arabic');

    expect(screen.queryByRole('button', { name: /^Create/ })).toBeNull();
    expect(vocabulary().getByRole('button', { name: 'Arabic' })).toBeVisible();
  });

  it('invites the first word when the Tenant has no Tags for Applications at all', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...getsApplication(REVIEW),
      ...filesApplicationTags({ vocabulary: [] }),
    );

    const { user, tags } = await openTags();

    await user.click(tags.getByRole('button', { name: 'Add a Tag' }));

    expect(
      screen.getByText(
        'Your team has no Tags for Applications yet. Type a word to make the first one.',
      ),
    ).toBeVisible();
  });

  it('puts the server’s reason for refusing a Tag beside the picker, and files nothing', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...getsApplication(REVIEW),
      ...refusesApplicationTag({ vocabulary: VOCABULARY }, TAG_WRONG_SCOPE),
    );

    const { user, tags } = await openTags();

    await user.click(tags.getByRole('button', { name: 'Add a Tag' }));
    await user.click(vocabulary().getByRole('button', { name: 'Arabic' }));

    expect(await tags.findByText('Tags unchanged')).toBeVisible();
    expect(
      tags.getByText('That Tag is candidate-scoped and cannot go on an Application.'),
    ).toBeVisible();
    expect(screen.queryByRole('list', { name: 'Tags on this Application' })).toBeNull();
  });

  it('keeps a minted word the Application could not then be filed under', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...getsApplication(REVIEW),
      ...refusesApplicationTag({ vocabulary: VOCABULARY }, TAG_WRONG_SCOPE),
    );

    const { user, tags } = await openTags();

    await user.click(tags.getByRole('button', { name: 'Add a Tag' }));
    await user.type(screen.getByLabelText('Find or create a Tag'), 'Kurdish');
    await user.click(screen.getByRole('button', { name: 'Create “Kurdish”' }));

    expect(await tags.findByText('Tags unchanged')).toBeVisible();
    expect(screen.queryByRole('list', { name: 'Tags on this Application' })).toBeNull();

    await waitFor(() =>
      expect(vocabulary().getByRole('button', { name: 'Kurdish' })).toHaveAttribute(
        'aria-pressed',
        'false',
      ),
    );

    await user.type(screen.getByLabelText('Find or create a Tag'), 'Kurdish');
    expect(vocabulary().getByRole('button', { name: 'Kurdish' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Create “Kurdish”' })).toBeNull();
  });

  it('says why a word could not be created', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...getsApplication(REVIEW),
      ...refusesTenantTagCreation({ vocabulary: VOCABULARY }, TAG_NAME_TAKEN),
    );

    const { user, tags } = await openTags();

    await user.click(tags.getByRole('button', { name: 'Add a Tag' }));
    await user.type(screen.getByLabelText('Find or create a Tag'), 'Kurdish');
    await user.click(screen.getByRole('button', { name: 'Create “Kurdish”' }));

    expect(await tags.findByText('Tags unchanged')).toBeVisible();
    expect(
      tags.getByText('This tenant already has a tag called “Kurdish” in that scope.'),
    ).toBeVisible();
  });

  it('fails on its own, and retries on its own, leaving the rest of the page standing', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...getsApplication(REVIEW),
      ...failsToListApplicationTags(SERVER_FAULT),
    );

    const { user, tags } = await openTags();

    expect(await tags.findByRole('alert')).toHaveTextContent('Something went wrong on our side.');
    expect(tags.queryByRole('button', { name: 'Add a Tag' })).toBeNull();
    expect(screen.getByRole('heading', { level: 1, name: 'Amal Haddad' })).toBeVisible();
    expect(screen.getByRole('region', { name: 'Pipeline' })).toBeVisible();

    server.use(...listsApplicationTags([ARABIC], VOCABULARY));
    await user.click(tags.getByRole('button', { name: 'Retry' }));

    expect(await filedUnder().findByText('Arabic')).toBeVisible();
    expect(tags.queryByRole('alert')).toBeNull();
  });
});
