import type { components } from '@sync/api-client/schema';
import { http, PROFILE } from '@sync/api-client/testing';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderApp } from '../testing/render-app';
import { server } from '../testing/server';

type Cv = components['schemas']['Cv'];

function makeCv(overrides: Partial<Cv> = {}): Cv {
  return {
    id: 'cv_1',
    display_name: 'resume.pdf',
    parsing_status: 'ready',
    parsing_error: null,
    detected_language: 'en',
    is_current: false,
    created_at: '2026-07-30T10:00:00Z',
    parsed_at: '2026-07-30T10:01:00Z',
    ...overrides,
  };
}

/** Every CV screen needs a signed-in candidate behind the `_authed` guard. */
function authAsCandidate() {
  server.use(http.get('/v1/auth/me', ({ response }) => response(200).json(PROFILE)));
}

function fileInput(): HTMLInputElement {
  const input = document.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) throw new Error('file input not found');
  return input;
}

function pdf(name = 'my-cv.pdf'): File {
  return new File([new Uint8Array(1024)], name, { type: 'application/pdf' });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('CV management', () => {
  it('shows the empty state and the constraints when there are no CVs', async () => {
    authAsCandidate();
    server.use(http.get('/v1/candidates/me/cvs', ({ response }) => response(200).json([])));

    renderApp('/cvs');

    expect(await screen.findByText('No CVs yet')).toBeInTheDocument();
    expect(screen.getByText(/PDF, DOC or DOCX, up to 10 MB\. 0 of 5 used\./)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Upload CV' })).toBeEnabled();
  });

  it('uploads a valid file, showing progress, then the CV reading', async () => {
    authAsCandidate();
    const cvs: Cv[] = [];
    server.use(
      http.get('/v1/candidates/me/cvs', ({ response }) => response(200).json(cvs)),
      http.post('/v1/candidates/me/cvs', async ({ response }) => {
        await delay(100);
        const created = makeCv({
          id: 'cv_new',
          display_name: 'my-cv.pdf',
          parsing_status: 'processing',
        });
        cvs.push(created);
        return response(201).json(created);
      }),
    );

    renderApp('/cvs');
    await screen.findByText('No CVs yet');

    await userEvent.upload(fileInput(), pdf());

    expect(
      await screen.findByRole('progressbar', { name: /Uploading my-cv\.pdf/ }),
    ).toBeInTheDocument();
    expect(await screen.findByText('my-cv.pdf')).toBeInTheDocument();
    expect(await screen.findByText('Reading…')).toBeInTheDocument();
  });

  it('rejects an unsupported file in place without contacting the server', async () => {
    authAsCandidate();
    server.use(http.get('/v1/candidates/me/cvs', ({ response }) => response(200).json([])));

    renderApp('/cvs');
    await screen.findByText('No CVs yet');

    const png = new File([new Uint8Array(1024)], 'photo.png', { type: 'image/png' });
    // applyAccept:false lets the bad file reach our own validation, which the accept attr would hide.
    await userEvent.upload(fileInput(), png, { applyAccept: false });

    expect(await screen.findByRole('alert')).toHaveTextContent(/not a PDF, DOC or DOCX/);
  });

  it('explains a server-side upload refusal', async () => {
    authAsCandidate();
    server.use(
      http.get('/v1/candidates/me/cvs', ({ response }) =>
        response(200).json([makeCv({ id: 'a' }), makeCv({ id: 'b' })]),
      ),
      http.post('/v1/candidates/me/cvs', ({ response }) =>
        response(409).json({ type: 'about:blank', title: 'Conflict', status: 409 }),
      ),
    );

    renderApp('/cvs');
    await screen.findByRole('button', { name: 'Upload CV' });

    await userEvent.upload(fileInput(), pdf());

    expect(await screen.findByRole('alert')).toHaveTextContent(/maximum of 5 CVs/);
  });

  it('polls a parsing CV until it is ready', async () => {
    authAsCandidate();
    let calls = 0;
    server.use(
      http.get('/v1/candidates/me/cvs', ({ response }) => {
        calls += 1;
        const status = calls === 1 ? 'processing' : 'ready';
        return response(200).json([
          makeCv({ id: 'cv_1', display_name: 'resume.pdf', parsing_status: status }),
        ]);
      }),
    );

    renderApp('/cvs');

    expect(await screen.findByText('Reading…')).toBeInTheDocument();
    expect(await screen.findByText('Ready', {}, { timeout: 3000 })).toBeInTheDocument();
  });

  it('explains a failed parse and invites another file', async () => {
    authAsCandidate();
    server.use(
      http.get('/v1/candidates/me/cvs', ({ response }) =>
        response(200).json([
          makeCv({ parsing_status: 'failed', parsing_error: 'The document had no readable text.' }),
        ]),
      ),
    );

    renderApp('/cvs');

    expect(
      await screen.findByText(
        /The document had no readable text\. Upload another file to try again\./,
      ),
    ).toBeInTheDocument();
  });

  it('disables upload with an explanation at the cap of five', async () => {
    authAsCandidate();
    const five = Array.from({ length: 5 }, (_, index) => makeCv({ id: `cv_${index}` }));
    server.use(http.get('/v1/candidates/me/cvs', ({ response }) => response(200).json(five)));

    renderApp('/cvs');

    expect(await screen.findByText(/reached the maximum of 5 CVs/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Upload CV' })).toBeDisabled();
  });

  it('makes a chosen CV current after an explicit confirmation', async () => {
    authAsCandidate();
    let switchedTo: string | null = null;
    const cvs = [
      makeCv({ id: 'cv_a', display_name: 'old.pdf', is_current: true }),
      makeCv({ id: 'cv_b', display_name: 'new.pdf', is_current: false }),
    ];
    server.use(
      http.get('/v1/candidates/me/cvs', ({ response }) => response(200).json(cvs)),
      http.post('/v1/candidates/me/cvs/{cv_id}/make-current', ({ params, response }) => {
        switchedTo = params.cv_id;
        for (const cv of cvs) cv.is_current = cv.id === params.cv_id;
        return response(200).json(cvs.find((cv) => cv.id === params.cv_id) as Cv);
      }),
    );

    renderApp('/cvs');

    await userEvent.click(await screen.findByRole('button', { name: /Make current/ }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/found by recruiters with new\.pdf/)).toBeInTheDocument();
    expect(
      within(dialog).getByText(/Applications you've already submitted keep the CV they used/),
    ).toBeInTheDocument();

    await userEvent.click(within(dialog).getByRole('button', { name: 'Make current' }));

    await waitFor(() => expect(switchedTo).toBe('cv_b'));
  });

  it('explains a failed make-current and keeps the dialog open', async () => {
    authAsCandidate();
    server.use(
      http.get('/v1/candidates/me/cvs', ({ response }) =>
        response(200).json([
          makeCv({ id: 'cv_a', display_name: 'old.pdf', is_current: true }),
          makeCv({ id: 'cv_b', display_name: 'new.pdf', is_current: false }),
        ]),
      ),
      http.post('/v1/candidates/me/cvs/{cv_id}/make-current', ({ response }) =>
        response(500).json({ type: 'about:blank', title: 'Server error', status: 500 }),
      ),
    );

    renderApp('/cvs');

    await userEvent.click(await screen.findByRole('button', { name: /Make current/ }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Make current' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(/couldn't be made current/);
    expect(within(dialog).getByRole('button', { name: 'Make current' })).toBeInTheDocument();
  });

  it('confirms before deleting, then removes the CV', async () => {
    authAsCandidate();
    let deleteCalls = 0;
    const cvs = [
      makeCv({ id: 'cv_a', display_name: 'first.pdf' }),
      makeCv({ id: 'cv_b', display_name: 'second.pdf' }),
    ];
    server.use(
      http.get('/v1/candidates/me/cvs', ({ response }) => response(200).json(cvs)),
      http.delete('/v1/candidates/me/cvs/{cv_id}', ({ params, response }) => {
        deleteCalls += 1;
        const index = cvs.findIndex((cv) => cv.id === params.cv_id);
        cvs.splice(index, 1);
        return response(204).empty();
      }),
    );

    renderApp('/cvs');

    const firstCard = (await screen.findByText('first.pdf')).closest('li') as HTMLElement;
    await userEvent.click(within(firstCard).getByRole('button', { name: /Delete/ }));

    // The confirm step stands between the click and the request.
    expect(await screen.findByText('Delete this CV?')).toBeInTheDocument();
    expect(deleteCalls).toBe(0);

    const dialog = screen.getByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(screen.queryByText('first.pdf')).not.toBeInTheDocument());
    expect(screen.getByText('second.pdf')).toBeInTheDocument();
    expect(deleteCalls).toBe(1);
  });

  it('refuses to delete the current CV and explains why', async () => {
    authAsCandidate();
    server.use(
      http.get('/v1/candidates/me/cvs', ({ response }) =>
        response(200).json([makeCv({ id: 'cv_a', display_name: 'current.pdf', is_current: true })]),
      ),
      http.delete('/v1/candidates/me/cvs/{cv_id}', ({ response }) =>
        response(409).json({ type: 'about:blank', title: 'Conflict', status: 409 }),
      ),
    );

    renderApp('/cvs');

    await userEvent.click(await screen.findByRole('button', { name: /Delete/ }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));

    expect(await screen.findByText(/Make another CV current first/)).toBeInTheDocument();
    expect(screen.getByText('current.pdf')).toBeInTheDocument();
  });

  it('downloads via a fresh short-lived link on each click', async () => {
    authAsCandidate();
    let minted = 0;
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    server.use(
      http.get('/v1/candidates/me/cvs', ({ response }) =>
        response(200).json([makeCv({ id: 'cv_a', display_name: 'resume.pdf' })]),
      ),
      http.get('/v1/candidates/me/cvs/{cv_id}/download', ({ response }) => {
        minted += 1;
        return response(200).json({
          url: `https://files.sync.test/link-${minted}`,
          expires_in_seconds: 60,
        });
      }),
    );

    renderApp('/cvs');

    const button = await screen.findByRole('button', { name: /Download/ });
    await userEvent.click(button);
    await waitFor(() =>
      expect(open).toHaveBeenCalledWith(
        'https://files.sync.test/link-1',
        '_blank',
        'noopener,noreferrer',
      ),
    );

    await userEvent.click(button);
    await waitFor(() =>
      expect(open).toHaveBeenCalledWith(
        'https://files.sync.test/link-2',
        '_blank',
        'noopener,noreferrer',
      ),
    );
  });

  it('reviews a profile draft and applies it only on confirmation', async () => {
    authAsCandidate();
    const captured: { body: components['schemas']['CandidateProfile'] | null } = { body: null };
    server.use(
      http.get('/v1/candidates/me/cvs', ({ response }) =>
        response(200).json([
          makeCv({ id: 'cv_a', display_name: 'resume.pdf', parsing_status: 'ready' }),
        ]),
      ),
      http.get('/v1/candidates/me/cvs/{cv_id}/profile-draft', ({ response }) =>
        response(200).json({
          full_name: 'Amina Haddad',
          headline: 'Backend engineer',
          is_searchable: false,
          skills: [
            { name: 'Python', years_experience: 6 },
            { name: 'Rust', years_experience: null },
          ],
        }),
      ),
      http.put('/v1/candidates/me/profile', async ({ request, response }) => {
        captured.body = (await request.json()) as components['schemas']['CandidateProfile'];
        return response(200).json(captured.body);
      }),
    );

    renderApp('/cvs');

    await userEvent.click(await screen.findByRole('button', { name: 'Review draft' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Amina Haddad')).toBeInTheDocument();
    expect(within(dialog).getByText(/replaces your current profile/)).toBeInTheDocument();

    await userEvent.type(within(dialog).getByLabelText('Years of experience for Rust'), '2');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Apply to profile' }));

    await waitFor(() => expect(captured.body).not.toBeNull());
    expect(captured.body?.full_name).toBe('Amina Haddad');
    expect(captured.body?.skills).toEqual([
      { name: 'Python', years_experience: 6 },
      { name: 'Rust', years_experience: 2 },
    ]);
    await waitFor(() => expect(screen.queryByText('Review profile draft')).not.toBeInTheDocument());
  });
});
