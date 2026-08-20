import type { components } from '@sync/api-client';
import { screen, waitFor, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import type { HttpHandler } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { signedInAs } from '@/features/auth/testing/handlers';
import {
  acceptsUpload,
  deletesCv,
  drafts,
  faultsOnDraft,
  faultsOnListingCvs,
  faultsOnUpload,
  linksDownloadInTurn,
  listsCvs,
  listsCvsInTurn,
  makesCurrent,
  refusesDraft,
  refusesMakeCurrent,
  refusesUpload,
  withholdsUpload,
} from '@/features/cvs/testing/handlers';
import { echoesProfile, hasProfile, savesProfile } from '@/features/profile/testing/handlers';
import {
  CANDIDATE,
  CANDIDATE_PROFILE,
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
  READY_CV,
  SERVER_FAULT,
} from '@/testing/fixtures';
import { renderApp } from '@/testing/render-app';
import { server } from '@/testing/server';

type CandidateProfile = components['schemas']['CandidateProfile'];

const PARSED_CV = { ...PROCESSING_CV, parsing_status: 'ready' as const, detected_language: 'en' };

const QUEUED_CV = {
  ...PROCESSING_CV,
  id: '00000000-0000-4000-8000-000000000206',
  display_name: 'just-uploaded.pdf',
  parsing_status: 'uploaded' as const,
};

const UPDATED_HEADLINE = CV_DRAFT.headline as string;
const OWN_HEADLINE = CANDIDATE_PROFILE.headline as string;

async function openProfile(
  handlers: HttpHandler[] = [],
  {
    profile = CANDIDATE_PROFILE,
    at = '/profile',
  }: { profile?: CandidateProfile; at?: string } = {},
) {
  server.use(...signedInAs(CANDIDATE), ...hasProfile(profile), ...handlers);
  return renderApp(at);
}

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

function updateQuestion(): HTMLElement {
  const notice = screen
    .getByText('The fields below now say what your CV says')
    .closest('[data-slot="alert"]');
  if (!notice) throw new Error('no update question on the page');
  return notice as HTMLElement;
}

function entry(label: string) {
  return within(screen.getByRole('group', { name: label }));
}

function headline() {
  return screen.getByLabelText('Headline');
}

function save(user: UserEvent) {
  return user.click(screen.getByRole('button', { name: 'Save profile' }));
}

async function updateFrom(user: UserEvent, cv: { display_name: string }) {
  await user.click(
    await screen.findByRole('button', { name: `Update the form from “${cv.display_name}”` }),
  );
  await waitFor(() => expect(headline()).toHaveValue(UPDATED_HEADLINE));
}

describe('the CVs on the profile', () => {
  it('is the page’s first section, above the fields it updates', async () => {
    await openProfile([...listsCvs([READY_CV])]);

    const sections = screen.getAllByRole('heading', { level: 2 }).map((node) => node.textContent);
    expect(sections[0]).toBe('CVs');
    expect(sections).toContain('About you');
  });

  it('lists what the candidate keeps, newest first, marking the current one', async () => {
    await openProfile([...listsCvs([CURRENT_CV, READY_CV])]);

    const list = await screen.findByRole('list', { name: 'Your CVs' });
    const names = within(list)
      .getAllByRole('heading')
      .map((heading) => heading.textContent);
    expect(names).toEqual([CURRENT_CV.display_name, READY_CV.display_name]);
    expect(within(cardFor(CURRENT_CV.display_name)).getByText('Current')).toBeVisible();
    expect(within(cardFor(READY_CV.display_name)).queryByText('Current')).toBeNull();
  });

  it('invites a first upload when there are none', async () => {
    await openProfile([...listsCvs([])]);

    expect(await screen.findByRole('button', { name: 'Upload your first CV' })).toBeVisible();
    expect(screen.queryByRole('list', { name: 'Your CVs' })).toBeNull();
  });

  it('offers a retry rather than losing the whole page when the list will not load', async () => {
    await openProfile([...faultsOnListingCvs(SERVER_FAULT)]);

    expect(await screen.findByText("Couldn't load your CVs")).toBeVisible();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeVisible();
    expect(headline()).toHaveValue(OWN_HEADLINE);
  });
});

describe('uploading a CV from the profile', () => {
  it('sends the file as multipart, and shows it once the list catches up', async () => {
    const sent = vi.fn();
    const { user } = await openProfile([
      ...listsCvsInTurn([], [PROCESSING_CV]),
      ...acceptsUpload(PROCESSING_CV, sent),
    ]);
    await pick(user, aPdf());

    await waitFor(() => expect(sent).toHaveBeenCalled());
    expect(sent.mock.calls[0]?.[0]).toMatch(/^multipart\/form-data/);
    expect(await screen.findByRole('heading', { name: PROCESSING_CV.display_name })).toBeVisible();
  });

  it('shows the upload running, naming the file', async () => {
    const { user } = await openProfile([...listsCvs([]), ...withholdsUpload()]);
    await pick(user, aPdf());

    expect(
      await screen.findByRole('progressbar', { name: 'Uploading “lina-khoury-cv.pdf”' }),
    ).toBeVisible();
  });

  it('offers only the formats the platform reads', async () => {
    await openProfile([...listsCvs([])]);

    const accept = (await screen.findByLabelText('Choose a CV file')).getAttribute('accept') ?? '';
    expect(accept).toContain('.pdf');
    expect(accept).toContain('.doc');
    expect(accept).toContain('.docx');
    expect(accept).toContain('application/pdf');
  });

  it('says what the size limit is when a file is over it, without asking the API', async () => {
    const uploaded = vi.fn();
    const { user } = await openProfile([...listsCvs([]), ...acceptsUpload(READY_CV, uploaded)]);
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
    const { user } = await openProfile([...listsCvs([CURRENT_CV]), ...refusesUpload(DUPLICATE_CV)]);
    await pick(user, aPdf());

    expect(await screen.findByText('You have already uploaded this file.')).toBeVisible();
  });

  it('sends a fault on our side to a toast, not to the picker', async () => {
    const { user } = await openProfile([...listsCvs([]), ...faultsOnUpload(SERVER_FAULT)]);
    await pick(user, aPdf());

    expect(await screen.findByText('Something went wrong on our side.')).toBeVisible();
    expect(screen.queryByText('That file did not go through')).toBeNull();
  });
});

describe('the cap of five', () => {
  it('disables uploading once the cap is reached, and explains why', async () => {
    await openProfile([...listsCvs(FIVE_CVS)]);

    expect(await screen.findByText('You are keeping all 5 CVs we hold')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Upload a CV' })).toBeDisabled();
    expect(screen.queryByLabelText('Choose a CV file')).toBeNull();
  });

  it('counts the free slots down before the cap is hit', async () => {
    await openProfile([...listsCvs([CURRENT_CV, READY_CV])]);

    expect(await screen.findByText(/3 of 5 slots free/)).toBeVisible();
  });

  it('repeats the API’s explanation if the cap is hit between the check and the upload', async () => {
    const { user } = await openProfile([
      ...listsCvs([CURRENT_CV]),
      ...refusesUpload(CV_LIMIT_REACHED),
    ]);
    await pick(user, aPdf());

    expect(
      await screen.findByText('You can keep 5 CVs at a time. Delete one you no longer need first.'),
    ).toBeVisible();
  });
});

describe('waiting for a CV to be read', () => {
  it('polls until the parse lands, then stops saying it is working', async () => {
    await openProfile([...listsCvsInTurn([PROCESSING_CV], [PARSED_CV]), ...drafts(CV_DRAFT)]);

    expect(await screen.findByText('Reading')).toBeVisible();
    expect(await screen.findByText('Ready')).toBeVisible();
    expect(screen.queryByText('Reading')).toBeNull();
  });

  it('spins on the row being read, and stops once it has been', async () => {
    await openProfile([...listsCvsInTurn([PROCESSING_CV], [PARSED_CV]), ...drafts(CV_DRAFT)]);

    const spinner = `Reading “${PROCESSING_CV.display_name}”`;
    expect(await screen.findByRole('progressbar', { name: spinner })).toBeVisible();

    await waitFor(() => expect(screen.queryByRole('progressbar', { name: spinner })).toBeNull());
  });

  it('spins on every CV still to be read, and on none that is settled', async () => {
    await openProfile([...listsCvs([QUEUED_CV, PROCESSING_CV, READY_CV, FAILED_CV])]);

    const spinners = await screen.findAllByRole('progressbar');
    expect(spinners.map((node) => node.getAttribute('aria-label'))).toEqual([
      `Reading “${QUEUED_CV.display_name}”`,
      `Reading “${PROCESSING_CV.display_name}”`,
    ]);
  });

  it('explains a failed parse and invites another file', async () => {
    await openProfile([...listsCvs([FAILED_CV])]);

    const card = cardFor(FAILED_CV.display_name);
    expect(within(card).getByText("Couldn't be read")).toBeVisible();
    expect(within(card).getByText(FAILED_CV.parsing_error as string)).toBeVisible();
    expect(
      within(card).getByText(/It cannot update the form below or be made current/),
    ).toBeVisible();
  });

  it('offers neither current nor an update on a CV that could not be read', async () => {
    await openProfile([...listsCvs([FAILED_CV])]);

    const card = cardFor(FAILED_CV.display_name);
    expect(within(card).queryByRole('button', { name: /Make .* current/ })).toBeNull();
    expect(within(card).queryByRole('button', { name: /Update the form from/ })).toBeNull();
  });
});

describe('switching the current CV', () => {
  it('says what current means before making the change', async () => {
    const { user } = await openProfile([...listsCvs([CURRENT_CV, READY_CV])]);
    await user.click(
      await screen.findByRole('button', { name: `Make “${READY_CV.display_name}” current` }),
    );

    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveAccessibleName('Apply with this CV from now on?');
    expect(within(dialog).getByText(READY_CV.display_name)).toBeVisible();
    expect(within(dialog).getByText(/goes out with every new application/)).toBeVisible();
    expect(within(dialog).getByText(/what recruiters find you by/)).toBeVisible();
    expect(
      within(dialog).getByText(/Applications already sent keep the CV they went out with/),
    ).toBeVisible();
  });

  it('switches only after the candidate confirms', async () => {
    const { user } = await openProfile([
      ...listsCvsInTurn(
        [CURRENT_CV, READY_CV],
        [
          { ...CURRENT_CV, is_current: false },
          { ...READY_CV, is_current: true },
        ],
      ),
      ...makesCurrent({ ...READY_CV, is_current: true }),
    ]);
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
    const { user } = await openProfile([
      ...listsCvs([CURRENT_CV, READY_CV]),
      ...refusesMakeCurrent(CV_NOT_READY_FOR_CURRENT),
    ]);
    await user.click(
      await screen.findByRole('button', { name: `Make “${READY_CV.display_name}” current` }),
    );
    await user.click(await screen.findByRole('button', { name: 'Make it current' }));

    expect(await screen.findByText(/it cannot be the current one/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Make it current' })).toBeVisible();
  });

  it('leaves the current CV alone when the candidate backs out', async () => {
    const { user } = await openProfile([...listsCvs([CURRENT_CV, READY_CV])]);
    await user.click(
      await screen.findByRole('button', { name: `Make “${READY_CV.display_name}” current` }),
    );
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(within(cardFor(CURRENT_CV.display_name)).getByText('Current')).toBeVisible();
  });
});

describe('a CV named at length', () => {
  const LONG_CV = {
    ...READY_CV,
    display_name: `${'lina-khoury-monitoring-and-evaluation-consultant-'.repeat(5)}final.pdf`,
  };

  it('clips the name on the card rather than widening it', async () => {
    await openProfile([...listsCvs([LONG_CV])]);

    const heading = await screen.findByRole('heading', { name: LONG_CV.display_name });
    expect(heading.firstElementChild).toHaveAttribute('data-slot', 'tooltip-trigger');
  });

  it('keeps the name out of the delete dialog’s question, and clips it there too', async () => {
    const { user } = await openProfile([...listsCvs([LONG_CV])]);
    await user.click(
      await screen.findByRole('button', { name: `Delete “${LONG_CV.display_name}”` }),
    );

    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveAccessibleName('Delete this CV?');
    expect(within(dialog).getByText(LONG_CV.display_name)).toHaveAttribute(
      'data-slot',
      'tooltip-trigger',
    );
  });
});

describe('deleting a CV', () => {
  it('asks first, and says what deleting does not undo', async () => {
    const { user } = await openProfile([...listsCvs([READY_CV])]);
    await user.click(
      await screen.findByRole('button', { name: `Delete “${READY_CV.display_name}”` }),
    );

    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText(/frees a slot/)).toBeVisible();
    expect(within(dialog).getByText(/can still read it/)).toBeVisible();
  });

  it('deletes nothing until the candidate confirms', async () => {
    const deleted = vi.fn();
    const { user } = await openProfile([...listsCvs([READY_CV]), ...deletesCv(deleted)]);
    await user.click(
      await screen.findByRole('button', { name: `Delete “${READY_CV.display_name}”` }),
    );
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(deleted).not.toHaveBeenCalled();
  });

  it('deletes the CV the candidate confirmed, and drops it from the list', async () => {
    const deleted = vi.fn();
    const { user } = await openProfile([
      ...listsCvsInTurn([CURRENT_CV, READY_CV], [CURRENT_CV]),
      ...deletesCv(deleted),
    ]);
    await user.click(
      await screen.findByRole('button', { name: `Delete “${READY_CV.display_name}”` }),
    );
    await user.click(await screen.findByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(deleted).toHaveBeenCalledWith(READY_CV.id));
    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: READY_CV.display_name })).toBeNull(),
    );
  });

  it('says why the current CV cannot go, before offering to delete it', async () => {
    await openProfile([...listsCvs([CURRENT_CV, READY_CV])]);

    const card = cardFor(CURRENT_CV.display_name);
    expect(
      within(card).getByRole('button', { name: `Delete “${CURRENT_CV.display_name}”` }),
    ).toBeDisabled();
    expect(
      within(card).getByText('The current CV cannot be deleted. Make another one current first.'),
    ).toBeVisible();
  });

  it('leaves delete open on every CV that is not the current one', async () => {
    await openProfile([...listsCvs([CURRENT_CV, READY_CV])]);

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
    const { user } = await openProfile([
      ...listsCvs([READY_CV]),
      ...linksDownloadInTurn('https://files.test/first', 'https://files.test/second'),
    ]);
    const button = await screen.findByRole('button', {
      name: `Download “${READY_CV.display_name}”`,
    });

    await user.click(button);
    await waitFor(() => expect(tabs[0]?.location.href).toBe('https://files.test/first'));
    await user.click(button);
    await waitFor(() => expect(tabs[1]?.location.href).toBe('https://files.test/second'));
  });

  it('opens the tab while the click is still the reason for it', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    const { user } = await openProfile([
      ...listsCvs([READY_CV]),
      ...linksDownloadInTurn('https://files.test/first'),
    ]);
    await user.click(
      await screen.findByRole('button', { name: `Download “${READY_CV.display_name}”` }),
    );

    expect(open).toHaveBeenCalledWith('', '_blank');
  });
});

describe('a CV updating the form', () => {
  it('updates the fields as soon as a newly uploaded CV has been read, saving nothing', async () => {
    const saved = vi.fn();
    const { user } = await openProfile([
      ...listsCvsInTurn([], [PROCESSING_CV], [PARSED_CV]),
      ...acceptsUpload(PROCESSING_CV),
      ...drafts(CV_DRAFT),
      ...echoesProfile(saved),
    ]);
    await pick(user, aPdf());

    expect(await screen.findByText('Reading')).toBeVisible();
    expect(headline()).toHaveValue(OWN_HEADLINE);

    await waitFor(() => expect(headline()).toHaveValue(UPDATED_HEADLINE));
    expect(saved).not.toHaveBeenCalled();
  });

  it('updates once for one parse, however often the list is polled after it', async () => {
    const asked = vi.fn();
    const { user } = await openProfile([
      ...listsCvsInTurn([], [PROCESSING_CV], [PARSED_CV]),
      ...acceptsUpload(PROCESSING_CV),
      ...drafts(CV_DRAFT, asked),
    ]);
    await pick(user, aPdf());

    await waitFor(() => expect(headline()).toHaveValue(UPDATED_HEADLINE));
    expect(asked).toHaveBeenCalledTimes(1);
    expect(asked).toHaveBeenCalledWith(PROCESSING_CV.id);
  });

  it('updates when a CV that was already being read on arrival finishes', async () => {
    await openProfile([...listsCvsInTurn([PROCESSING_CV], [PARSED_CV]), ...drafts(CV_DRAFT)]);

    expect(await screen.findByText('Reading')).toBeVisible();
    expect(headline()).toHaveValue(OWN_HEADLINE);

    await waitFor(() => expect(headline()).toHaveValue(UPDATED_HEADLINE));
    expect(within(updateQuestion()).getByText(PARSED_CV.display_name)).toBeVisible();
  });

  it('leaves a CV that was already read on arrival to be asked for', async () => {
    const asked = vi.fn();
    await openProfile([...listsCvs([READY_CV]), ...drafts(CV_DRAFT, asked)]);

    expect(await screen.findByRole('heading', { name: READY_CV.display_name })).toBeVisible();
    expect(headline()).toHaveValue(OWN_HEADLINE);
    expect(asked).not.toHaveBeenCalled();
  });

  it('leaves the fields alone while the CV is still being read', async () => {
    const { user } = await openProfile([
      ...listsCvsInTurn([], [PROCESSING_CV]),
      ...acceptsUpload(PROCESSING_CV),
    ]);
    await pick(user, aPdf());

    expect(await screen.findByText('Reading')).toBeVisible();
    expect(headline()).toHaveValue(OWN_HEADLINE);
  });

  it('updates nothing from a CV the platform could not read', async () => {
    const failed = { ...PROCESSING_CV, parsing_status: 'failed' as const, parsing_error: 'Empty.' };
    const { user } = await openProfile([
      ...listsCvsInTurn([], [PROCESSING_CV], [failed]),
      ...acceptsUpload(PROCESSING_CV),
    ]);
    await pick(user, aPdf());

    expect(await screen.findByText("Couldn't be read")).toBeVisible();
    expect(headline()).toHaveValue(OWN_HEADLINE);
  });

  it('updates from a CV that was already read, when asked', async () => {
    const { user } = await openProfile([...listsCvs([READY_CV]), ...drafts(CV_DRAFT)]);
    await updateFrom(user, READY_CV);

    expect(entry('Job 1').getByLabelText('Job title')).toHaveValue('Backend engineer');
    expect(entry('Job 1').getByLabelText('Employer')).toHaveValue('Levant Digital');
  });

  it('reaches the Links, the same way it reaches the sections', async () => {
    const { user } = await openProfile([...listsCvs([READY_CV]), ...drafts(CV_DRAFT)]);
    await updateFrom(user, READY_CV);

    const links = within(screen.getByRole('region', { name: 'Links' }));
    expect(links.getByLabelText('LinkedIn')).toHaveValue(
      'https://www.linkedin.com/in/lina-from-the-cv',
    );
    expect(links.getByLabelText('GitHub')).toHaveValue('https://github.com/lina-from-the-cv');
    expect(links.getByLabelText('Portfolio or website')).toHaveValue('');
  });

  it('names the CV that updated the form, and says nothing has been saved', async () => {
    const { user } = await openProfile([...listsCvs([READY_CV]), ...drafts(CV_DRAFT)]);
    await updateFrom(user, READY_CV);

    expect(within(updateQuestion()).getByText(READY_CV.display_name)).toBeVisible();
    expect(screen.getByText(/Nothing has been saved/)).toBeVisible();
    expect(screen.getByText('Unsaved changes.')).toBeVisible();
  });

  it('replaces the sections the CV speaks for, and empties the ones it is silent about', async () => {
    const { user } = await openProfile([...listsCvs([READY_CV]), ...drafts(CV_DRAFT)]);
    await updateFrom(user, READY_CV);

    expect(screen.queryByRole('group', { name: 'Qualification 1' })).toBeNull();
    expect(screen.queryByRole('group', { name: 'Project 1' })).toBeNull();
    expect(
      screen.getByText('No projects listed yet — add something you built or ran.'),
    ).toBeVisible();
  });

  it('keeps the skills already listed, with their years, and adds the CV’s', async () => {
    const { user } = await openProfile([...listsCvs([READY_CV]), ...drafts(CV_DRAFT)]);
    await updateFrom(user, READY_CV);

    expect(entry('Skill 1').getByLabelText('Skill')).toHaveValue('Python');
    expect(entry('Skill 1').getByLabelText('Years')).toHaveValue(3.5);
    expect(entry('Skill 2').getByLabelText('Skill')).toHaveValue('Kubernetes');
    expect(entry('Skill 2').getByLabelText('Years')).toHaveValue(null);
  });

  it('leaves a skill the CV introduced to ordinary validation rather than a step of its own', async () => {
    const saved = vi.fn();
    const { user } = await openProfile([
      ...listsCvs([READY_CV]),
      ...drafts(CV_DRAFT),
      ...echoesProfile(saved),
    ]);
    await updateFrom(user, READY_CV);
    await save(user);

    expect(await screen.findByText('Enter years of experience.')).toBeVisible();
    expect(saved).not.toHaveBeenCalled();
  });

  it('leaves a job the CV never dated to be dated before the profile will save', async () => {
    const saved = vi.fn();
    const undated = {
      ...CV_DRAFT,
      experiences: [
        { job_title: 'Backend engineer', company_name: 'Levant Digital', is_current: false },
      ],
    };
    const { user } = await openProfile([
      ...listsCvs([READY_CV]),
      ...drafts(undated),
      ...echoesProfile(saved),
    ]);
    await updateFrom(user, READY_CV);
    await save(user);

    expect(await screen.findByText('Enter the year.')).toBeVisible();
    expect(saved).not.toHaveBeenCalled();
  });

  it('surfaces a skill the platform has no name for instead of dropping it', async () => {
    const { user } = await openProfile([...listsCvs([READY_CV]), ...drafts(CV_DRAFT)]);
    await updateFrom(user, READY_CV);

    expect(
      within(screen.getByRole('region', { name: 'Other skills' })).getByText('Sphere Standards'),
    ).toBeVisible();
  });

  it('never moves the candidate, and saves the Location it left alone', async () => {
    const sent: { body?: CandidateProfile } = {};
    const { user } = await openProfile([
      ...listsCvs([READY_CV]),
      ...drafts(CV_DRAFT),
      ...echoesProfile((body) => {
        sent.body = body;
      }),
    ]);
    await updateFrom(user, READY_CV);

    expect(screen.getByLabelText('Location')).toHaveValue('Aleppo');

    await user.type(entry('Skill 2').getByLabelText('Years'), '2');
    await save(user);

    await waitFor(() => expect(sent.body).toBeDefined());
    expect(sent.body?.location_key).toBe(CANDIDATE_PROFILE.location_key);
  });

  it('saves what the CV updated, and what the candidate changed after it, on Save', async () => {
    const sent: { body?: CandidateProfile } = {};
    const { user } = await openProfile([
      ...listsCvs([READY_CV]),
      ...drafts(CV_DRAFT),
      ...echoesProfile((body) => {
        sent.body = body;
      }),
    ]);
    await updateFrom(user, READY_CV);

    await user.type(entry('Skill 2').getByLabelText('Years'), '2');
    await user.clear(headline());
    await user.type(headline(), 'Backend engineer and trainer');
    await save(user);

    expect(await screen.findByText('Profile saved.')).toBeVisible();
    expect(sent.body).toMatchObject({
      full_name: CV_DRAFT.full_name,
      headline: 'Backend engineer and trainer',
      location_key: 'sy-aleppo',
      experiences: [
        {
          job_title: 'Backend engineer',
          company_name: 'Levant Digital',
          start_year: 2021,
          is_current: true,
        },
      ],
      educations: [],
      skills: [
        { name: 'Python', years_experience: 3.5 },
        { name: 'Kubernetes', years_experience: 2 },
      ],
      unmapped_skills: ['Sphere Standards'],
    });
    expect(headline()).toHaveValue('Backend engineer and trainer');
    expect(screen.getByText('Everything is saved.')).toBeVisible();
  });

  it('still asks before leaving with an update nobody saved', async () => {
    const { user } = await openProfile([...listsCvs([READY_CV]), ...drafts(CV_DRAFT)]);
    await updateFrom(user, READY_CV);

    const nav = screen.getByRole('navigation', { name: 'Sections' });
    await user.click(within(nav).getByRole('link', { name: 'Jobs' }));

    expect(await screen.findByRole('heading', { name: 'Leave without saving?' })).toBeVisible();
  });

  it('says beside the CV when the API will not draft from it, and changes nothing', async () => {
    const { user } = await openProfile([
      ...listsCvs([READY_CV]),
      ...refusesDraft(CV_NOT_READY_FOR_DRAFT),
    ]);
    await user.click(
      await screen.findByRole('button', {
        name: `Update the form from “${READY_CV.display_name}”`,
      }),
    );

    expect(await screen.findByText('That CV did not update the form')).toBeVisible();
    expect(screen.getByText(CV_NOT_READY_FOR_DRAFT.detail as string)).toBeVisible();
    expect(headline()).toHaveValue(OWN_HEADLINE);
    expect(screen.getByText('Everything is saved.')).toBeVisible();
  });

  it('sends a fault on our side to a toast rather than blaming the CV', async () => {
    const { user } = await openProfile([...listsCvs([READY_CV]), ...faultsOnDraft(SERVER_FAULT)]);
    await user.click(
      await screen.findByRole('button', {
        name: `Update the form from “${READY_CV.display_name}”`,
      }),
    );

    expect(await screen.findByText('Something went wrong on our side.')).toBeVisible();
    expect(screen.queryByText('That CV did not update the form')).toBeNull();
  });

  it('drops a refusal once the profile has been saved', async () => {
    const { user } = await openProfile([
      ...listsCvs([READY_CV]),
      ...refusesDraft(CV_NOT_READY_FOR_DRAFT),
      ...echoesProfile(),
    ]);
    await user.click(
      await screen.findByRole('button', {
        name: `Update the form from “${READY_CV.display_name}”`,
      }),
    );
    await screen.findByText('That CV did not update the form');

    await user.clear(headline());
    await user.type(headline(), 'Coordinator and trainer');
    await save(user);

    expect(await screen.findByText('Profile saved.')).toBeVisible();
    expect(screen.queryByText('That CV did not update the form')).toBeNull();
  });
});

describe('uploading a CV and saving what it updated', () => {
  it('reads the file, updates the fields, saves nothing until asked, and keeps what it saved', async () => {
    const sent: { body?: CandidateProfile } = {};
    const { user } = await openProfile([
      ...listsCvsInTurn([], [PROCESSING_CV], [PARSED_CV]),
      ...acceptsUpload(PROCESSING_CV),
      ...drafts(CV_DRAFT),
      ...echoesProfile((body) => {
        sent.body = body;
      }),
    ]);

    await pick(user, aPdf());
    expect(await screen.findByText('Reading')).toBeVisible();
    expect(headline()).toHaveValue(OWN_HEADLINE);

    await waitFor(() => expect(headline()).toHaveValue(UPDATED_HEADLINE));
    expect(entry('Job 1').getByLabelText('Job title')).toHaveValue('Backend engineer');
    expect(sent.body).toBeUndefined();

    await user.type(entry('Skill 2').getByLabelText('Years'), '4');
    await user.clear(headline());
    await user.type(headline(), 'Backend engineer, Aleppo');
    await save(user);

    expect(await screen.findByText('Profile saved.')).toBeVisible();
    expect(sent.body).toMatchObject({
      headline: 'Backend engineer, Aleppo',
      skills: [
        { name: 'Python', years_experience: 3.5 },
        { name: 'Kubernetes', years_experience: 4 },
      ],
    });
    expect(headline()).toHaveValue('Backend engineer, Aleppo');
    expect(entry('Skill 2').getByLabelText('Years')).toHaveValue(4);
    expect(screen.getByText('Everything is saved.')).toBeVisible();
  });
});

describe('arriving from the notification about a parse', () => {
  it('updates the form from the CV the address names, and says which one spoke', async () => {
    await openProfile([...listsCvs([CURRENT_CV, READY_CV]), ...drafts(CV_DRAFT)], {
      at: `/profile?update=${READY_CV.id}`,
    });

    await waitFor(() => expect(headline()).toHaveValue(UPDATED_HEADLINE));
    expect(within(updateQuestion()).getByText(READY_CV.display_name)).toBeVisible();
    expect(entry('Job 1').getByLabelText('Job title')).toHaveValue('Backend engineer');
  });

  it('asks that CV for the draft, and no other', async () => {
    const asked = vi.fn();
    await openProfile([...listsCvs([CURRENT_CV, READY_CV]), ...drafts(CV_DRAFT, asked)], {
      at: `/profile?update=${READY_CV.id}`,
    });

    await waitFor(() => expect(headline()).toHaveValue(UPDATED_HEADLINE));
    expect(asked).toHaveBeenCalledTimes(1);
    expect(asked).toHaveBeenCalledWith(READY_CV.id);
  });

  it('puts back what the fields held when the update is undone', async () => {
    const { user } = await openProfile([...listsCvs([READY_CV]), ...drafts(CV_DRAFT)], {
      at: `/profile?update=${READY_CV.id}`,
    });
    await waitFor(() => expect(headline()).toHaveValue(UPDATED_HEADLINE));

    await user.click(screen.getByRole('button', { name: 'Undo the update' }));

    expect(headline()).toHaveValue(OWN_HEADLINE);
    expect(screen.getByText('Everything is saved.')).toBeVisible();
  });

  it('updates nothing from a CV that is gone, and leaves the page usable', async () => {
    const asked = vi.fn();
    await openProfile([...listsCvs([READY_CV]), ...drafts(CV_DRAFT, asked)], {
      at: '/profile?update=00000000-0000-4000-8000-000000000999',
    });

    expect(await screen.findByRole('heading', { name: READY_CV.display_name })).toBeVisible();
    expect(headline()).toHaveValue(OWN_HEADLINE);
    expect(asked).not.toHaveBeenCalled();
  });

  it('updates nothing from a CV the platform could not read', async () => {
    const asked = vi.fn();
    await openProfile([...listsCvs([FAILED_CV]), ...drafts(CV_DRAFT, asked)], {
      at: `/profile?update=${FAILED_CV.id}`,
    });

    expect(await screen.findByText("Couldn't be read")).toBeVisible();
    expect(headline()).toHaveValue(OWN_HEADLINE);
    expect(asked).not.toHaveBeenCalled();
  });
});

describe('undoing an update', () => {
  it('puts back exactly what the form held, hand-written and unsaved included', async () => {
    const { user } = await openProfile([...listsCvs([READY_CV]), ...drafts(CV_DRAFT)]);

    await user.clear(headline());
    await user.type(headline(), 'Coordinator and trainer');
    await updateFrom(user, READY_CV);

    await user.click(screen.getByRole('button', { name: 'Undo the update' }));

    expect(headline()).toHaveValue('Coordinator and trainer');
    expect(entry('Job 1').getByLabelText('Job title')).toHaveValue('Field Coordinator');
    expect(entry('Qualification 1').getByLabelText('Institution')).toHaveValue(
      'University of Aleppo',
    );
    expect(entry('Skill 1').getByLabelText('Years')).toHaveValue(3.5);
    expect(screen.queryByRole('group', { name: 'Skill 2' })).toBeNull();
    expect(
      within(screen.getByRole('region', { name: 'Other skills' })).getByText('Kobo Toolbox'),
    ).toBeVisible();
    expect(entry('Project 1').getByLabelText('Project name')).toHaveValue('Distribution tracker');
    expect(
      within(screen.getByRole('region', { name: 'Links' })).getByLabelText('LinkedIn'),
    ).toHaveValue('https://www.linkedin.com/in/lina-khoury');
    expect(screen.queryByText(/The fields below now say/)).toBeNull();
  });

  it('leaves a profile that was untouched before the update reading as saved', async () => {
    const { user } = await openProfile([...listsCvs([READY_CV]), ...drafts(CV_DRAFT)]);
    await updateFrom(user, READY_CV);

    await user.click(screen.getByRole('button', { name: 'Undo the update' }));

    expect(headline()).toHaveValue(OWN_HEADLINE);
    expect(screen.getByText('Everything is saved.')).toBeVisible();
  });

  it('keeps the update, and drops the question, when that is what the candidate meant', async () => {
    const { user } = await openProfile([...listsCvs([READY_CV]), ...drafts(CV_DRAFT)]);
    await updateFrom(user, READY_CV);

    await user.click(screen.getByRole('button', { name: 'Keep it' }));

    expect(screen.queryByText(/The fields below now say/)).toBeNull();
    expect(headline()).toHaveValue(UPDATED_HEADLINE);
    expect(screen.getByText('Unsaved changes.')).toBeVisible();
  });

  it('updates an empty profile with nothing to undo, and says so all the same', async () => {
    const { user } = await openProfile(
      [...listsCvs([READY_CV]), ...drafts(CV_DRAFT), ...savesProfile(EMPTY_PROFILE)],
      { profile: EMPTY_PROFILE },
    );
    await updateFrom(user, READY_CV);

    expect(screen.getByRole('button', { name: 'Undo the update' })).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Undo the update' }));

    expect(headline()).toHaveValue('');
    expect(screen.getByText('Everything is saved.')).toBeVisible();
  });
});
