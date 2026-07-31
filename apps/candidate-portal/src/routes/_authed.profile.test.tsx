import { http, PROFILE } from '@sync/api-client/testing';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { CANDIDATE_PROFILE } from '../features/profile/testing/profile';
import { renderApp } from '../testing/render-app';
import { server } from '../testing/server';

/** Auth guard + the profile load, the two GETs every profile-page render needs. */
function stubLoad() {
  server.use(
    http.get('/v1/auth/me', ({ response }) => response(200).json(PROFILE)),
    http.get('/v1/candidates/me/profile', ({ response }) => response(200).json(CANDIDATE_PROFILE)),
  );
}

describe('profile editor', () => {
  beforeEach(stubLoad);

  it('loads the whole profile into the form', async () => {
    renderApp('/profile');

    expect(await screen.findByLabelText('Full name')).toHaveValue('Amina Haddad');
    expect(screen.getByLabelText('Location')).toHaveValue('Damascus, Syria');
    expect(screen.getByLabelText('Skill')).toHaveValue('Python');
    expect(screen.getByLabelText('Years of experience')).toHaveValue(5);
    expect(screen.getByLabelText('Job title')).toHaveValue('Senior Engineer');
  });

  it('validates a required field in-form and does not save', async () => {
    let putCalled = false;
    server.use(
      http.put('/v1/candidates/me/profile', ({ response }) => {
        putCalled = true;
        return response(200).json(CANDIDATE_PROFILE);
      }),
    );

    renderApp('/profile');

    await userEvent.clear(await screen.findByLabelText('Full name'));
    await userEvent.click(screen.getByRole('button', { name: 'Save profile' }));

    expect(await screen.findByText('Enter your full name')).toBeInTheDocument();
    expect(putCalled).toBe(false);
  });

  it('replaces the whole profile on save and confirms it', async () => {
    let body: { full_name?: string } | undefined;
    server.use(
      http.put('/v1/candidates/me/profile', async ({ request, response }) => {
        body = (await request.json()) as { full_name?: string };
        return response(200).json({ ...CANDIDATE_PROFILE, full_name: 'Amina H. Haddad' });
      }),
    );

    renderApp('/profile');

    const fullName = await screen.findByLabelText('Full name');
    await userEvent.clear(fullName);
    await userEvent.type(fullName, 'Amina H. Haddad');
    await userEvent.click(screen.getByRole('button', { name: 'Save profile' }));

    expect(await screen.findByText('Profile saved')).toBeInTheDocument();
    expect(body?.full_name).toBe('Amina H. Haddad');
  });

  it('renders a server field rejection at the offending field and the form root', async () => {
    server.use(
      http.put('/v1/candidates/me/profile', ({ response }) =>
        response(422).json({
          type: 'https://sync.example/problems/validation-error',
          title: 'Validation error',
          status: 422,
          errors: [
            {
              location: 'body.skills.0.name',
              message: 'Not a Canonical skill',
              type: 'value_error',
            },
          ],
        }),
      ),
    );

    renderApp('/profile');

    await userEvent.click(await screen.findByRole('button', { name: 'Save profile' }));

    expect(await screen.findByText('Not a Canonical skill')).toBeInTheDocument();
    expect(
      screen.getByText('Some entries were rejected — see the highlighted fields.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Skill')).toHaveAttribute('aria-invalid', 'true');
  });

  it('renders a 409 searchable-needs-a-CV rejection on the toggle', async () => {
    server.use(
      http.put('/v1/candidates/me/profile', ({ response }) =>
        response(409).json({
          type: 'https://sync.example/problems/searchable-needs-cv',
          title: 'Conflict',
          status: 409,
          detail:
            'Upload a CV and wait for it to be processed before making your profile searchable.',
        }),
      ),
    );

    renderApp('/profile');

    await userEvent.click(await screen.findByLabelText("List me in Sync's cross-tenant search"));
    await userEvent.click(screen.getByRole('button', { name: 'Save profile' }));

    expect(
      await screen.findByText(
        'Upload a CV and wait for it to be processed before making your profile searchable.',
      ),
    ).toBeInTheDocument();
  });
});
