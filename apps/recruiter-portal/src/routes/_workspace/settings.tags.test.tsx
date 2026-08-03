import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { signedInAs } from '@/features/auth/testing/handlers';
import {
  ARABIC,
  HAS_A_LICENCE,
  OPEN_TO_RELOCATION,
  TAG_NAME_TAKEN,
} from '@/features/crm/testing/fixtures';
import {
  curatesVocabulary,
  failsToDeleteTag,
  listsVocabulary,
  refusesTagRename,
} from '@/features/crm/testing/handlers';
import { RANA } from '@/features/team/testing/fixtures';
import { listsMembers } from '@/features/team/testing/handlers';
import { RECRUITER, SERVER_FAULT } from '@/testing/fixtures';
import { renderApp } from '@/testing/render-app';
import { server } from '@/testing/server';

const TAGS = '/settings?tab=tags';

function rowOf(name: string) {
  return within(screen.getByRole('row', { name: new RegExp(name) }));
}

async function openActions(user: { click: (element: Element) => Promise<void> }, name: string) {
  await user.click(await screen.findByRole('button', { name: `Actions for ${name}` }));
}

describe('the Tags tab', () => {
  it('lists the whole vocabulary, saying what each Tag may be put on', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...listsMembers([RANA]),
      ...listsVocabulary([ARABIC, HAS_A_LICENCE, OPEN_TO_RELOCATION]),
    );

    await renderApp(TAGS);

    expect(await screen.findByText('Arabic')).toBeVisible();
    expect(rowOf('Arabic').getByText('Applications')).toBeVisible();
    expect(rowOf('Open to relocation').getByText('Candidates')).toBeVisible();
  });

  it('invites the first word when the Tenant has none', async () => {
    server.use(...signedInAs(RECRUITER), ...listsMembers([RANA]), ...listsVocabulary([]));

    await renderApp(TAGS);

    expect(
      await screen.findByText(
        'No Tags yet — add the first word your team will file Candidates and Applications under.',
      ),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Add the first Tag' })).toBeVisible();
  });

  it('adds a Tag in the scope it was chosen for, and lists it', async () => {
    const onCreate = vi.fn();
    server.use(
      ...signedInAs(RECRUITER),
      ...listsMembers([RANA]),
      ...curatesVocabulary([ARABIC], { onCreate }),
    );

    const { user } = await renderApp(TAGS);
    await user.click(await screen.findByRole('button', { name: 'Add a Tag' }));
    await user.type(screen.getByLabelText('Name'), 'Kurdish');
    await user.click(screen.getByRole('radio', { name: /Candidates/ }));
    await user.click(screen.getByRole('button', { name: 'Add Tag' }));

    await waitFor(() =>
      expect(onCreate).toHaveBeenCalledExactlyOnceWith({ name: 'Kurdish', scope: 'candidate' }),
    );
    expect(await screen.findByText('Tag added')).toBeVisible();
    expect(await screen.findByText('Kurdish')).toBeVisible();
    expect(rowOf('Kurdish').getByText('Candidates')).toBeVisible();
  });

  it('refuses a word the Tenant already files by in that scope without asking the API', async () => {
    const onCreate = vi.fn();
    server.use(
      ...signedInAs(RECRUITER),
      ...listsMembers([RANA]),
      ...curatesVocabulary([ARABIC], { onCreate }),
    );

    const { user } = await renderApp(TAGS);
    await user.click(await screen.findByRole('button', { name: 'Add a Tag' }));
    await user.type(screen.getByLabelText('Name'), 'arabic');
    await user.click(screen.getByRole('button', { name: 'Add Tag' }));

    expect(
      await screen.findByText('Your Tenant already files Applications under “Arabic”.'),
    ).toBeVisible();
    expect(onCreate).not.toHaveBeenCalled();
  });

  it('takes the same word in the other scope, because a Tag is unique per scope', async () => {
    const onCreate = vi.fn();
    server.use(
      ...signedInAs(RECRUITER),
      ...listsMembers([RANA]),
      ...curatesVocabulary([ARABIC], { onCreate }),
    );

    const { user } = await renderApp(TAGS);
    await user.click(await screen.findByRole('button', { name: 'Add a Tag' }));
    await user.type(screen.getByLabelText('Name'), 'Arabic');
    await user.click(screen.getByRole('radio', { name: /Candidates/ }));
    await user.click(screen.getByRole('button', { name: 'Add Tag' }));

    await waitFor(() =>
      expect(onCreate).toHaveBeenCalledExactlyOnceWith({ name: 'Arabic', scope: 'candidate' }),
    );
  });

  it('renames a Tag in place, and everything filed under it keeps its scope', async () => {
    const onRename = vi.fn();
    server.use(
      ...signedInAs(RECRUITER),
      ...listsMembers([RANA]),
      ...curatesVocabulary([ARABIC, HAS_A_LICENCE], { onRename }),
    );

    const { user } = await renderApp(TAGS);
    await openActions(user, 'Arabic');
    await user.click(await screen.findByRole('menuitem', { name: 'Rename Tag' }));

    const name = await screen.findByLabelText('Name');
    expect(name).toHaveValue('Arabic');
    await user.clear(name);
    await user.type(name, 'Arabic speaker');
    await user.click(screen.getByRole('button', { name: 'Save name' }));

    await waitFor(() =>
      expect(onRename).toHaveBeenCalledExactlyOnceWith(ARABIC.id, { name: 'Arabic speaker' }),
    );
    expect(await screen.findByText('Tag renamed')).toBeVisible();
    expect(await screen.findByText('Arabic speaker')).toBeVisible();
    expect(rowOf('Arabic speaker').getByText('Applications')).toBeVisible();
  });

  it('reads a rename the API refuses beneath the name it refused', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...listsMembers([RANA]),
      ...listsVocabulary([ARABIC, HAS_A_LICENCE]),
      ...refusesTagRename(TAG_NAME_TAKEN),
    );

    const { user } = await renderApp(TAGS);
    await openActions(user, 'Arabic');
    await user.click(await screen.findByRole('menuitem', { name: 'Rename Tag' }));

    const name = await screen.findByLabelText('Name');
    await user.clear(name);
    await user.type(name, 'Kurdish');
    await user.click(screen.getByRole('button', { name: 'Save name' }));

    expect(
      await screen.findByText('This tenant already has a tag called “Kurdish” in that scope.'),
    ).toBeVisible();
    expect(screen.getByRole('dialog')).toBeVisible();
  });

  it('asks before deleting, saying that deleting unfiles everything it was on', async () => {
    const onDelete = vi.fn();
    server.use(
      ...signedInAs(RECRUITER),
      ...listsMembers([RANA]),
      ...curatesVocabulary([ARABIC, HAS_A_LICENCE], { onDelete }),
    );

    const { user } = await renderApp(TAGS);
    await openActions(user, 'Arabic');
    await user.click(await screen.findByRole('menuitem', { name: 'Delete Tag' }));

    const asking = await screen.findByRole('alertdialog');
    expect(asking).toHaveTextContent('Delete “Arabic”?');
    expect(asking).toHaveTextContent(
      'Every Application filed under it loses it. The Applications themselves are untouched.',
    );
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.getByText('Arabic')).toBeVisible();
  });

  it('deletes a Tag once confirmed, and drops it from the vocabulary', async () => {
    const onDelete = vi.fn();
    server.use(
      ...signedInAs(RECRUITER),
      ...listsMembers([RANA]),
      ...curatesVocabulary([ARABIC, HAS_A_LICENCE], { onDelete }),
    );

    const { user } = await renderApp(TAGS);
    await openActions(user, 'Arabic');
    await user.click(await screen.findByRole('menuitem', { name: 'Delete Tag' }));
    await user.click(await screen.findByRole('button', { name: 'Delete Tag' }));

    await waitFor(() => expect(onDelete).toHaveBeenCalledExactlyOnceWith(ARABIC.id));
    expect(await screen.findByText('Tag deleted')).toBeVisible();
    await waitFor(() => expect(screen.queryByText('Arabic')).not.toBeInTheDocument());
    expect(screen.getByText('Has a driving licence')).toBeVisible();
  });

  it('keeps the vocabulary and the confirmation when a delete actually fails', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...listsMembers([RANA]),
      ...listsVocabulary([ARABIC]),
      ...failsToDeleteTag(SERVER_FAULT),
    );

    const { user } = await renderApp(TAGS);
    await openActions(user, 'Arabic');
    await user.click(await screen.findByRole('menuitem', { name: 'Delete Tag' }));
    await user.click(await screen.findByRole('button', { name: 'Delete Tag' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong on our side.');
    expect(screen.getByRole('alertdialog')).toBeVisible();
    expect(screen.getByText('Arabic')).toBeVisible();
  });
});
