import { screen, waitFor, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { signedInAs } from '@/features/auth/testing/handlers';
import {
  acceptsUpload,
  deletesCv,
  drafts,
  faultsOnListingCvs,
  faultsOnUpload,
  hasProfile,
  linksDownloadInTurn,
  listsCvs,
  listsCvsInTurn,
  makesCurrent,
  refusesDraft,
  refusesMakeCurrent,
  refusesProfile,
  refusesUpload,
  savesProfile,
  withholdsUpload,
} from '@/features/cvs/testing/handlers';
import {
  CANDIDATE,
  CURRENT_CV,
  CV_DRAFT,
  CV_LIMIT_REACHED,
  CV_NOT_READY_FOR_CURRENT,
  CV_NOT_READY_FOR_DRAFT,
  DUPLICATE_CV,
  EMPTY_PROFILE,
  FAILED_CV,
  FIVE_CVS,
  PROCESSING_CV,
  PROFILE_WITH_SKILL,
  READY_CV,
  SERVER_FAULT,
} from '@/testing/fixtures';
import { renderApp } from '@/testing/render-app';
import { server } from '@/testing/server';

function aPdf(name = 'lina-khoury-cv.pdf'): File {
  return new File([new Uint8Array(2048)], name, { type: 'application/pdf' });
}

async function pick(user: UserEvent, file: File) {
  await user.upload(screen.getByLabelText('Choose a CV file'), file);
}

function cardFor(displayName: string): HTMLElement {
  const heading = screen.getByRole('heading', { name: displayName });
  const card = heading.closest('li');
  if (!card) throw new Error(`no card for ${displayName}`);
  return card;
}

describe('the CVs page', () => {
  it('lists what the candidate keeps, newest first, marking the current one', async () => {
    server.use(...signedInAs(CANDIDATE), ...listsCvs([CURRENT_CV, READY_CV]));

    await renderApp('/cvs');

    const list = await screen.findByRole('list', { name: 'Your CVs' });
    const names = within(list)
      .getAllByRole('heading')
      .map((heading) => heading.textContent);
    expect(names).toEqual([CURRENT_CV.display_name, READY_CV.display_name]);
    expect(within(cardFor(CURRENT_CV.display_name)).getByText('Current')).toBeVisible();
    expect(within(cardFor(READY_CV.display_name)).queryByText('Current')).toBeNull();
  });

  it('invites a first upload when there are none', async () => {
    server.use(...signedInAs(CANDIDATE), ...listsCvs([]));

    await renderApp('/cvs');

    expect(await screen.findByRole('button', { name: 'Upload your first CV' })).toBeVisible();
    expect(screen.queryByRole('list', { name: 'Your CVs' })).toBeNull();
  });

  it('offers a retry rather than a blank page when the list will not load', async () => {
    server.use(...signedInAs(CANDIDATE), ...faultsOnListingCvs(SERVER_FAULT));

    await renderApp('/cvs');

    expect(await screen.findByText("Couldn't load your CVs")).toBeVisible();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeVisible();
  });
});

describe('uploading a CV', () => {
  it('sends the file as multipart, and shows it once the list catches up', async () => {
    const sent = vi.fn();
    server.use(
      ...signedInAs(CANDIDATE),
      ...listsCvsInTurn([], [PROCESSING_CV]),
      ...acceptsUpload(PROCESSING_CV, sent),
    );

    const { user } = await renderApp('/cvs');
    await pick(user, aPdf());

    await waitFor(() => expect(sent).toHaveBeenCalled());
    expect(sent.mock.calls[0]?.[0]).toMatch(/^multipart\/form-data/);
    expect(await screen.findByRole('heading', { name: PROCESSING_CV.display_name })).toBeVisible();
  });

  it('shows the upload running, naming the file', async () => {
    server.use(...signedInAs(CANDIDATE), ...listsCvs([]), ...withholdsUpload());

    const { user } = await renderApp('/cvs');
    await pick(user, aPdf());

    expect(
      await screen.findByRole('progressbar', { name: 'Uploading “lina-khoury-cv.pdf”' }),
    ).toBeVisible();
  });

  // The picker itself is the first constraint; `rejectionFor` is the second, and is unit-tested
  // in `file-check.test.ts` — a browser file dialog can still be talked into "All files".
  it('offers only the formats the platform reads', async () => {
    server.use(...signedInAs(CANDIDATE), ...listsCvs([]));

    await renderApp('/cvs');

    const accept = (await screen.findByLabelText('Choose a CV file')).getAttribute('accept') ?? '';
    expect(accept).toContain('.pdf');
    expect(accept).toContain('.doc');
    expect(accept).toContain('.docx');
    expect(accept).toContain('application/pdf');
  });

  it('says what the size limit is when a file is over it, without asking the API', async () => {
    const uploaded = vi.fn();
    server.use(...signedInAs(CANDIDATE), ...listsCvs([]), ...acceptsUpload(READY_CV, uploaded));

    const { user } = await renderApp('/cvs');
    const huge = new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'big.pdf', {
      type: 'application/pdf',
    });
    await pick(user, huge);

    expect(
      await screen.findByText('That file is larger than 10 MB. Try a smaller one.'),
    ).toBeVisible();
    expect(uploaded).not.toHaveBeenCalled();
  });

  it('says so when the file is one the candidate already keeps', async () => {
    server.use(...signedInAs(CANDIDATE), ...listsCvs([CURRENT_CV]), ...refusesUpload(DUPLICATE_CV));

    const { user } = await renderApp('/cvs');
    await pick(user, aPdf());

    expect(await screen.findByText('You have already uploaded this file.')).toBeVisible();
  });

  it('sends a fault on our side to a toast, not to the picker', async () => {
    server.use(...signedInAs(CANDIDATE), ...listsCvs([]), ...faultsOnUpload(SERVER_FAULT));

    const { user } = await renderApp('/cvs');
    await pick(user, aPdf());

    expect(await screen.findByText('Something went wrong on our side.')).toBeVisible();
    expect(screen.queryByText('That file did not go through')).toBeNull();
  });
});

describe('the cap of five', () => {
  it('disables uploading once the cap is reached, and explains why', async () => {
    server.use(...signedInAs(CANDIDATE), ...listsCvs(FIVE_CVS));

    await renderApp('/cvs');

    expect(await screen.findByText('You are keeping all 5 CVs we hold')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Upload a CV' })).toBeDisabled();
    expect(screen.queryByLabelText('Choose a CV file')).toBeNull();
  });

  it('counts the free slots down before the cap is hit', async () => {
    server.use(...signedInAs(CANDIDATE), ...listsCvs([CURRENT_CV, READY_CV]));

    await renderApp('/cvs');

    expect(await screen.findByText(/3 of 5 slots free/)).toBeVisible();
  });

  it('repeats the API’s explanation if the cap is hit between the check and the upload', async () => {
    server.use(
      ...signedInAs(CANDIDATE),
      ...listsCvs([CURRENT_CV]),
      ...refusesUpload(CV_LIMIT_REACHED),
    );

    const { user } = await renderApp('/cvs');
    await pick(user, aPdf());

    expect(
      await screen.findByText('You can keep 5 CVs at a time. Delete one you no longer need first.'),
    ).toBeVisible();
  });
});

describe('waiting for a CV to be read', () => {
  it('polls until the parse lands, then stops saying it is working', async () => {
    server.use(
      ...signedInAs(CANDIDATE),
      ...listsCvsInTurn([PROCESSING_CV], [{ ...PROCESSING_CV, parsing_status: 'ready' }]),
    );

    await renderApp('/cvs');

    expect(await screen.findByText('Reading')).toBeVisible();
    expect(await screen.findByText('Ready')).toBeVisible();
    expect(screen.queryByText('Reading')).toBeNull();
  });

  it('explains a failed parse and invites another file', async () => {
    server.use(...signedInAs(CANDIDATE), ...listsCvs([FAILED_CV]));

    await renderApp('/cvs');

    const card = cardFor(FAILED_CV.display_name);
    expect(within(card).getByText("Couldn't be read")).toBeVisible();
    expect(within(card).getByText(FAILED_CV.parsing_error as string)).toBeVisible();
    expect(within(card).getByText(/It cannot fill your profile or be made current/)).toBeVisible();
  });

  it('offers neither current nor draft on a CV that could not be read', async () => {
    server.use(...signedInAs(CANDIDATE), ...listsCvs([FAILED_CV]));

    await renderApp('/cvs');

    const card = cardFor(FAILED_CV.display_name);
    expect(within(card).queryByRole('button', { name: /Make .* current/ })).toBeNull();
    expect(within(card).queryByRole('button', { name: /Fill profile from/ })).toBeNull();
  });
});

describe('switching the current CV', () => {
  it('says what current means before making the change', async () => {
    server.use(...signedInAs(CANDIDATE), ...listsCvs([CURRENT_CV, READY_CV]));

    const { user } = await renderApp('/cvs');
    await user.click(
      await screen.findByRole('button', { name: `Make “${READY_CV.display_name}” current` }),
    );

    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText(/sent with every new application/)).toBeVisible();
    expect(within(dialog).getByText(/recruiters searching the platform find you by/)).toBeVisible();
    expect(
      within(dialog).getByText(/Applications you have already sent keep the CV they went out with/),
    ).toBeVisible();
  });

  it('switches only after the candidate confirms', async () => {
    server.use(
      ...signedInAs(CANDIDATE),
      ...listsCvsInTurn(
        [CURRENT_CV, READY_CV],
        [
          { ...CURRENT_CV, is_current: false },
          { ...READY_CV, is_current: true },
        ],
      ),
      ...makesCurrent({ ...READY_CV, is_current: true }),
    );

    const { user } = await renderApp('/cvs');
    await user.click(
      await screen.findByRole('button', { name: `Make “${READY_CV.display_name}” current` }),
    );
    await user.click(await screen.findByRole('button', { name: 'Make it current' }));

    await waitFor(() =>
      expect(within(cardFor(READY_CV.display_name)).getByText('Current')).toBeVisible(),
    );
    expect(within(cardFor(CURRENT_CV.display_name)).queryByText('Current')).toBeNull();
  });

  it('explains a CV the API will not take as current yet', async () => {
    server.use(
      ...signedInAs(CANDIDATE),
      ...listsCvs([CURRENT_CV, READY_CV]),
      ...refusesMakeCurrent(CV_NOT_READY_FOR_CURRENT),
    );

    const { user } = await renderApp('/cvs');
    await user.click(
      await screen.findByRole('button', { name: `Make “${READY_CV.display_name}” current` }),
    );
    await user.click(await screen.findByRole('button', { name: 'Make it current' }));

    expect(await screen.findByText(/it cannot be the current one/)).toBeVisible();
    // Still asking, rather than closing on a switch that did not happen.
    expect(screen.getByRole('button', { name: 'Make it current' })).toBeVisible();
  });

  it('leaves the current CV alone when the candidate backs out', async () => {
    const listed = listsCvs([CURRENT_CV, READY_CV]);
    server.use(...signedInAs(CANDIDATE), ...listed);

    const { user } = await renderApp('/cvs');
    await user.click(
      await screen.findByRole('button', { name: `Make “${READY_CV.display_name}” current` }),
    );
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(within(cardFor(CURRENT_CV.display_name)).getByText('Current')).toBeVisible();
  });
});

describe('deleting a CV', () => {
  it('asks first, and says what deleting does not undo', async () => {
    server.use(...signedInAs(CANDIDATE), ...listsCvs([READY_CV]));

    const { user } = await renderApp('/cvs');
    await user.click(
      await screen.findByRole('button', { name: `Delete “${READY_CV.display_name}”` }),
    );

    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText(/frees a slot/)).toBeVisible();
    expect(within(dialog).getByText(/can still read it/)).toBeVisible();
  });

  it('deletes nothing until the candidate confirms', async () => {
    const deleted = vi.fn();
    server.use(...signedInAs(CANDIDATE), ...listsCvs([READY_CV]), ...deletesCv(deleted));

    const { user } = await renderApp('/cvs');
    await user.click(
      await screen.findByRole('button', { name: `Delete “${READY_CV.display_name}”` }),
    );
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(deleted).not.toHaveBeenCalled();
  });

  it('deletes the CV the candidate confirmed, and drops it from the list', async () => {
    const deleted = vi.fn();
    server.use(
      ...signedInAs(CANDIDATE),
      ...listsCvsInTurn([CURRENT_CV, READY_CV], [CURRENT_CV]),
      ...deletesCv(deleted),
    );

    const { user } = await renderApp('/cvs');
    await user.click(
      await screen.findByRole('button', { name: `Delete “${READY_CV.display_name}”` }),
    );
    await user.click(await screen.findByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(deleted).toHaveBeenCalledWith(READY_CV.id));
    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: READY_CV.display_name })).toBeNull(),
    );
  });

  // The API refuses this outright, so the reader is told before they act, not after (§ "every
  // state are communicated before the user hits them").
  it('says why the current CV cannot go, before offering to delete it', async () => {
    server.use(...signedInAs(CANDIDATE), ...listsCvs([CURRENT_CV, READY_CV]));

    await renderApp('/cvs');

    const card = cardFor(CURRENT_CV.display_name);
    expect(
      within(card).getByRole('button', { name: `Delete “${CURRENT_CV.display_name}”` }),
    ).toBeDisabled();
    expect(
      within(card).getByText('The current CV cannot be deleted. Make another one current first.'),
    ).toBeVisible();
  });

  it('leaves delete open on every CV that is not the current one', async () => {
    server.use(...signedInAs(CANDIDATE), ...listsCvs([CURRENT_CV, READY_CV]));

    await renderApp('/cvs');

    expect(
      within(cardFor(READY_CV.display_name)).getByRole('button', {
        name: `Delete “${READY_CV.display_name}”`,
      }),
    ).toBeEnabled();
  });
});

describe('downloading the original file', () => {
  it('asks for a fresh link on every click rather than reusing one', async () => {
    const tabs: { location: { href: string } }[] = [];
    vi.spyOn(window, 'open').mockImplementation(() => {
      const tab = { location: { href: '' }, opener: {}, close: vi.fn() };
      tabs.push(tab);
      return tab as unknown as Window;
    });
    server.use(
      ...signedInAs(CANDIDATE),
      ...listsCvs([READY_CV]),
      ...linksDownloadInTurn('https://files.test/first', 'https://files.test/second'),
    );

    const { user } = await renderApp('/cvs');
    const button = await screen.findByRole('button', {
      name: `Download “${READY_CV.display_name}”`,
    });

    await user.click(button);
    await waitFor(() => expect(tabs[0]?.location.href).toBe('https://files.test/first'));
    await user.click(button);
    await waitFor(() => expect(tabs[1]?.location.href).toBe('https://files.test/second'));
  });

  // Opened on the click, not after the link lands, or Safari treats it as an unrequested popup.
  it('opens the tab while the click is still the reason for it', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    server.use(
      ...signedInAs(CANDIDATE),
      ...listsCvs([READY_CV]),
      ...linksDownloadInTurn('https://files.test/first'),
    );

    const { user } = await renderApp('/cvs');
    await user.click(
      await screen.findByRole('button', { name: `Download “${READY_CV.display_name}”` }),
    );

    expect(open).toHaveBeenCalledWith('', '_blank');
  });
});

describe('filling the profile from a CV', () => {
  it('shows what applying would change, and changes nothing on its own', async () => {
    const saved = vi.fn();
    server.use(
      ...signedInAs(CANDIDATE),
      ...listsCvs([READY_CV]),
      ...drafts(CV_DRAFT),
      ...hasProfile(EMPTY_PROFILE),
      ...savesProfile(saved),
    );

    const { user } = await renderApp('/cvs');
    await user.click(
      await screen.findByRole('button', { name: `Fill profile from “${READY_CV.display_name}”` }),
    );

    const changes = await screen.findByRole('list', { name: 'What would change' });
    expect(within(changes).getByText('Headline')).toBeVisible();
    expect(within(changes).getByText('Backend engineer, 8 years')).toBeVisible();
    expect(within(changes).getByText('Experience')).toBeVisible();
    expect(within(changes).getByText('1 entry')).toBeVisible();
    expect(saved).not.toHaveBeenCalled();
  });

  it('says plainly that the sections listed are replaced, not merged', async () => {
    server.use(
      ...signedInAs(CANDIDATE),
      ...listsCvs([READY_CV]),
      ...drafts(CV_DRAFT),
      ...hasProfile(EMPTY_PROFILE),
    );

    const { user } = await renderApp('/cvs');
    await user.click(
      await screen.findByRole('button', { name: `Fill profile from “${READY_CV.display_name}”` }),
    );

    expect(
      await screen.findByText(/replaced by what the CV says, not merged with it/),
    ).toBeVisible();
  });

  // Skills are the one section the API merges. Telling the candidate their saved skills would
  // be overwritten would be false, and would talk them out of a safe change.
  it('does not claim saved skills are overwritten, because the API keeps them', async () => {
    server.use(
      ...signedInAs(CANDIDATE),
      ...listsCvs([READY_CV]),
      ...drafts(CV_DRAFT),
      ...hasProfile(PROFILE_WITH_SKILL),
    );

    const { user } = await renderApp('/cvs');
    await user.click(
      await screen.findByRole('button', { name: `Fill profile from “${READY_CV.display_name}”` }),
    );

    expect(
      await screen.findByText(/Skills are the exception: the ones already on your profile stay/),
    ).toBeVisible();
  });

  it('will not save a skill the CV introduced until its years are filled in', async () => {
    const saved = vi.fn();
    server.use(
      ...signedInAs(CANDIDATE),
      ...listsCvs([READY_CV]),
      ...drafts(CV_DRAFT),
      ...hasProfile(EMPTY_PROFILE),
      ...savesProfile(saved),
    );

    const { user } = await renderApp('/cvs');
    await user.click(
      await screen.findByRole('button', { name: `Fill profile from “${READY_CV.display_name}”` }),
    );
    await user.click(await screen.findByRole('button', { name: 'Apply to profile' }));

    expect(await screen.findByText('Enter the years.')).toBeVisible();
    expect(saved).not.toHaveBeenCalled();
  });

  it('saves the draft, with the years the candidate typed, once confirmed', async () => {
    const saved = vi.fn();
    server.use(
      ...signedInAs(CANDIDATE),
      ...listsCvs([READY_CV]),
      ...drafts(CV_DRAFT),
      ...hasProfile(EMPTY_PROFILE),
      ...savesProfile(saved),
    );

    const { user } = await renderApp('/cvs');
    await user.click(
      await screen.findByRole('button', { name: `Fill profile from “${READY_CV.display_name}”` }),
    );
    await user.type(await screen.findByLabelText('Kubernetes — years of experience'), '2');
    await user.click(screen.getByRole('button', { name: 'Apply to profile' }));

    await waitFor(() => expect(saved).toHaveBeenCalled());
    expect(saved.mock.calls[0]?.[0]).toMatchObject({
      headline: 'Backend engineer, 8 years',
      skills: [
        { name: 'Python', years_experience: 3 },
        { name: 'Kubernetes', years_experience: 2 },
      ],
    });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('keeps the review open when the profile will not save', async () => {
    server.use(
      ...signedInAs(CANDIDATE),
      ...listsCvs([READY_CV]),
      ...drafts(CV_DRAFT),
      ...hasProfile(EMPTY_PROFILE),
      ...refusesProfile(SERVER_FAULT),
    );

    const { user } = await renderApp('/cvs');
    await user.click(
      await screen.findByRole('button', { name: `Fill profile from “${READY_CV.display_name}”` }),
    );
    await user.type(await screen.findByLabelText('Kubernetes — years of experience'), '2');
    await user.click(screen.getByRole('button', { name: 'Apply to profile' }));

    expect(await screen.findByText('Something went wrong on our side.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Apply to profile' })).toBeVisible();
  });

  it('explains a draft the API will not produce yet', async () => {
    server.use(
      ...signedInAs(CANDIDATE),
      ...listsCvs([READY_CV]),
      ...refusesDraft(CV_NOT_READY_FOR_DRAFT),
      ...hasProfile(EMPTY_PROFILE),
    );

    const { user } = await renderApp('/cvs');
    await user.click(
      await screen.findByRole('button', { name: `Fill profile from “${READY_CV.display_name}”` }),
    );

    expect(
      await screen.findByText(
        'This CV has not been read yet, so there is nothing to fill a profile from.',
      ),
    ).toBeVisible();
  });
});
