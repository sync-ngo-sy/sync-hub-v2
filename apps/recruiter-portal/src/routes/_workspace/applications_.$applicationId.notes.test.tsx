import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AMAL_REVIEW } from '@/features/applications/testing/fixtures';
import {
  failsToListApplicationNotes,
  getsApplication,
  keepsApplicationNotes,
  listsApplicationNotes,
  pagesApplicationNotes,
  refusesApplicationNoteWrites,
} from '@/features/applications/testing/handlers';
import { signedInAs } from '@/features/auth/testing/handlers';
import { CALLED_HER, REFERENCE_CHECKED } from '@/features/crm/testing/fixtures';
import { absoluteDateTime } from '@/lib/dates';
import { RECRUITER, SERVER_FAULT } from '@/testing/fixtures';
import { renderApp } from '@/testing/render-app';
import { server } from '@/testing/server';

const REVIEW = AMAL_REVIEW;
const AT = `/applications/${REVIEW.id}`;

async function openNotes() {
  const rendered = await renderApp(AT);
  const notes = await screen.findByRole('region', { name: 'Notes' });
  return { ...rendered, notes: within(notes) };
}

function noteSaying(words: string) {
  const item = screen.getByText(new RegExp(words)).closest('li');
  if (!item) throw new Error(`No note saying “${words}”.`);
  return within(item);
}

describe('the Notes on the Application review page', () => {
  it('says whose team memory this is, and that the candidate never reads it', async () => {
    server.use(...signedInAs(RECRUITER), ...getsApplication(REVIEW));

    const { notes } = await openNotes();

    expect(notes.getByText('Your team only — the candidate never sees these.')).toBeVisible();
  });

  it('lists what the team has written, newest first, each credited and dated', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...getsApplication(REVIEW),
      ...listsApplicationNotes([CALLED_HER, REFERENCE_CHECKED]),
    );

    const { notes } = await openNotes();

    const written = await notes.findAllByRole('listitem');
    expect(written[0]).toHaveTextContent('Rana Aljabri');
    expect(written[0]).toHaveTextContent(CALLED_HER.text);
    expect(written[1]).toHaveTextContent('Omar Zayed');
    expect(written[1]).toHaveTextContent(REFERENCE_CHECKED.text);
  });

  it('dates a note by when it was written, and a rewritten one by the rewrite', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...getsApplication(REVIEW),
      ...listsApplicationNotes([CALLED_HER, REFERENCE_CHECKED]),
    );

    const { notes } = await openNotes();

    await notes.findByText(CALLED_HER.text);
    const written = noteSaying('Called her');
    expect(written.getByTitle(absoluteDateTime(CALLED_HER.created_at))).toBeVisible();
    expect(written.queryByText(/edited/)).toBeNull();

    const rewritten = noteSaying('Hand in Hand confirmed');
    expect(rewritten.getByTitle(absoluteDateTime(REFERENCE_CHECKED.updated_at))).toBeVisible();
    expect(rewritten.getByText(/edited/)).toBeVisible();
  });

  it('says so plainly when nobody has written anything yet', async () => {
    server.use(...signedInAs(RECRUITER), ...getsApplication(REVIEW));

    const { notes } = await openNotes();

    expect(
      notes.getByText(
        'Nothing written down yet. The first note is the one your colleagues will read first.',
      ),
    ).toBeVisible();
  });

  it('writes a note and puts it at the top, credited to the recruiter who wrote it', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...getsApplication(REVIEW),
      ...keepsApplicationNotes([REFERENCE_CHECKED]),
    );

    const { user, notes } = await openNotes();

    await user.type(notes.getByLabelText('New note'), 'She asked about the Idlib route.');
    await user.click(notes.getByRole('button', { name: 'Add note' }));

    expect(await screen.findByText('Note added')).toBeVisible();
    const written = await notes.findAllByRole('listitem');
    expect(written[0]).toHaveTextContent('She asked about the Idlib route.');
    expect(written[0]).toHaveTextContent('Rana Aljabri');
    expect(notes.getByLabelText('New note')).toHaveValue('');
  });

  it('refuses to send a note with nothing in it', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...getsApplication(REVIEW),
      ...listsApplicationNotes([CALLED_HER]),
    );

    const { user, notes } = await openNotes();

    await user.click(notes.getByRole('button', { name: 'Add note' }));

    expect(await notes.findByText('Write the note.')).toBeVisible();
  });

  it('rewrites a note in place and leaves the author it was written by', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...getsApplication(REVIEW),
      ...keepsApplicationNotes([REFERENCE_CHECKED]),
    );

    const { user, notes } = await openNotes();

    await notes.findByText(REFERENCE_CHECKED.text);
    await user.click(noteSaying('Hand in Hand confirmed').getByRole('button', { name: /^Edit/ }));

    const field = notes.getByLabelText('Note');
    expect(field).toHaveValue(REFERENCE_CHECKED.text);
    await user.clear(field);
    await user.type(field, 'Hand in Hand confirmed the dates, and the salary she was on.');
    await user.click(notes.getByRole('button', { name: 'Save note' }));

    expect(await screen.findByText('Note saved')).toBeVisible();
    expect(
      await notes.findByText('Hand in Hand confirmed the dates, and the salary she was on.'),
    ).toBeVisible();
    expect(notes.getByText(/Omar Zayed/)).toBeVisible();
    expect(notes.queryByLabelText('Note')).toBeNull();
  });

  it('abandons a rewrite without touching the note', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...getsApplication(REVIEW),
      ...keepsApplicationNotes([CALLED_HER]),
    );

    const { user, notes } = await openNotes();

    await notes.findByText(CALLED_HER.text);
    await user.click(noteSaying('Called her').getByRole('button', { name: /^Edit/ }));
    await user.type(notes.getByLabelText('Note'), ' — and a second thought.');
    await user.click(notes.getByRole('button', { name: 'Cancel' }));

    expect(notes.getByText(CALLED_HER.text)).toBeVisible();
    expect(notes.queryByLabelText('Note')).toBeNull();
  });

  it('deletes a note once the deletion is confirmed', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...getsApplication(REVIEW),
      ...keepsApplicationNotes([CALLED_HER, REFERENCE_CHECKED]),
    );

    const { user, notes } = await openNotes();

    await notes.findByText(CALLED_HER.text);
    await user.click(noteSaying('Called her').getByRole('button', { name: /^Delete/ }));

    expect(await screen.findByText('Delete this note?')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Delete note' }));

    expect(await screen.findByText('Note deleted')).toBeVisible();
    await waitFor(() => expect(notes.queryByText(CALLED_HER.text)).toBeNull());
    expect(notes.getByText(REFERENCE_CHECKED.text)).toBeVisible();
  });

  it('keeps a note the Recruiter changed their mind about deleting', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...getsApplication(REVIEW),
      ...keepsApplicationNotes([CALLED_HER]),
    );

    const { user, notes } = await openNotes();

    await notes.findByText(CALLED_HER.text);
    await user.click(noteSaying('Called her').getByRole('button', { name: /^Delete/ }));
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));

    expect(notes.getByText(CALLED_HER.text)).toBeVisible();
  });

  it('says a write was refused and leaves the notes reading as they did', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...getsApplication(REVIEW),
      ...refusesApplicationNoteWrites([CALLED_HER], SERVER_FAULT),
    );

    const { user, notes } = await openNotes();

    await notes.findByText(CALLED_HER.text);
    await user.type(notes.getByLabelText('New note'), 'A thought that will not land.');
    await user.click(notes.getByRole('button', { name: 'Add note' }));

    expect(await notes.findByText('Note not added')).toBeVisible();
    expect(notes.getByText('Something went wrong on our side.')).toBeVisible();
    expect(notes.getByText(CALLED_HER.text)).toBeVisible();
    expect(notes.getByLabelText('New note')).toHaveValue('A thought that will not land.');
  });

  it('says a deletion was refused and keeps the note it could not delete', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...getsApplication(REVIEW),
      ...refusesApplicationNoteWrites([CALLED_HER], SERVER_FAULT),
    );

    const { user, notes } = await openNotes();

    await notes.findByText(CALLED_HER.text);
    await user.click(noteSaying('Called her').getByRole('button', { name: /^Delete/ }));
    await user.click(await screen.findByRole('button', { name: 'Delete note' }));

    expect(await notes.findByText('Notes unchanged')).toBeVisible();
    expect(notes.getByText(CALLED_HER.text)).toBeVisible();
  });

  it('fetches the older notes only when they are asked for', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...getsApplication(REVIEW),
      ...pagesApplicationNotes([[CALLED_HER], [REFERENCE_CHECKED]]),
    );

    const { user, notes } = await openNotes();

    await notes.findByText(CALLED_HER.text);
    expect(notes.queryByText(REFERENCE_CHECKED.text)).toBeNull();

    await user.click(notes.getByRole('button', { name: 'Show older notes' }));

    expect(await notes.findByText(REFERENCE_CHECKED.text)).toBeVisible();
    await waitFor(() =>
      expect(notes.queryByRole('button', { name: 'Show older notes' })).toBeNull(),
    );
  });

  it('fails on its own, and retries on its own, leaving the rest of the page standing', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...getsApplication(REVIEW),
      ...failsToListApplicationNotes(SERVER_FAULT),
    );

    const { user, notes } = await openNotes();

    expect(await notes.findByRole('alert')).toHaveTextContent('Something went wrong on our side.');
    expect(screen.getByRole('heading', { level: 1, name: 'Amal Haddad' })).toBeVisible();
    expect(screen.getByRole('region', { name: 'Pipeline' })).toBeVisible();
    expect(screen.getByRole('region', { name: 'Snapshot' })).toBeVisible();

    server.use(...listsApplicationNotes([CALLED_HER]));
    await user.click(notes.getByRole('button', { name: 'Retry' }));

    expect(await notes.findByText(CALLED_HER.text)).toBeVisible();
    expect(notes.queryByRole('alert')).toBeNull();
  });
});
