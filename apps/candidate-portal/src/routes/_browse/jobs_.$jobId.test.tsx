import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  acceptsApplication,
  refusesApplication,
  refusesApplicationAnswers,
  withholdsApplication,
} from '@/features/applications/testing/handlers';
import { signedInAs, signedOut } from '@/features/auth/testing/handlers';
import { faultsOnJob, hasNoSuchJob, showsJob } from '@/features/jobs/testing/handlers';
import {
  APPLICATION,
  APPLICATION_ANSWER_REFUSED,
  BARE_PUBLIC_JOB,
  CANDIDATE,
  DUPLICATE_APPLICATION,
  PUBLIC_JOB,
  SERVER_FAULT,
} from '@/testing/fixtures';
import { renderApp } from '@/testing/render-app';
import { server } from '@/testing/server';

describe('a Job detail page', () => {
  it('reads the whole public Job: what the role is, and what it asks for', async () => {
    server.use(...signedOut(), ...showsJob(PUBLIC_JOB));

    await renderApp(`/jobs/${PUBLIC_JOB.id}`);

    expect(await screen.findByRole('heading', { level: 1, name: PUBLIC_JOB.title })).toBeVisible();
    expect(screen.getByText('Levant Digital · Remote · Full-time')).toBeVisible();
    expect(screen.getByText(/You will own the design system/)).toBeVisible();
    expect(screen.getByText('3+ years total experience')).toBeVisible();

    const skills = screen.getByRole('list', { name: 'Skills' });
    expect(within(skills).getByText('TypeScript')).toBeVisible();
    expect(within(skills).getByText('Required · 3+ years')).toBeVisible();
    // No minimum years on this one, so the row says how much it matters and stops there.
    expect(within(skills).getByText('React')).toBeVisible();
    expect(within(skills).getByText('Preferred')).toBeVisible();

    const languages = screen.getByRole('list', { name: 'Languages' });
    expect(within(languages).getByText('English')).toBeVisible();
    expect(within(languages).getByText('Fluent or better')).toBeVisible();
    expect(within(languages).getByText('Arabic')).toBeVisible();
    expect(within(languages).getByText('Native')).toBeVisible();

    const questions = screen.getByRole('list', { name: 'Application questions' });
    for (const question of PUBLIC_JOB.questions) {
      expect(within(questions).getByText(question.question_text)).toBeVisible();
    }
    // The shape of the answer, so a reader knows a yes/no from a paragraph before starting.
    expect(within(questions).getByText('Yes or no · Required')).toBeVisible();
    expect(within(questions).getByText('Short answer · Optional')).toBeVisible();
  });

  it('reads a Job that asks for no experience as asking for nothing', async () => {
    server.use(
      ...signedOut(),
      ...showsJob({ ...BARE_PUBLIC_JOB, minimum_total_experience_years: 0 }),
    );

    await renderApp(`/jobs/${BARE_PUBLIC_JOB.id}`);

    expect(await screen.findByRole('heading', { level: 1, name: 'Pharmacist' })).toBeVisible();
    // Zero years is no requirement at all, so neither the line nor the section it would open shows.
    expect(screen.queryByText(/years total experience/)).toBeNull();
    expect(screen.queryByRole('heading', { name: 'What this role asks for' })).toBeNull();
  });

  it('leaves out the criteria a Job carries none of', async () => {
    server.use(...signedOut(), ...showsJob(BARE_PUBLIC_JOB));

    await renderApp(`/jobs/${BARE_PUBLIC_JOB.id}`);

    expect(await screen.findByRole('heading', { level: 1, name: 'Pharmacist' })).toBeVisible();
    expect(screen.getByText(/Dispensing at our Damascus branch/)).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'What this role asks for' })).toBeNull();
    expect(screen.queryByRole('heading', { name: "What you'll be asked" })).toBeNull();
  });

  it('sends a reader whose role is no longer open back to the ones that are', async () => {
    server.use(...signedOut(), ...hasNoSuchJob());

    await renderApp(`/jobs/${PUBLIC_JOB.id}`);

    expect(await screen.findByRole('heading', { name: "This role isn't open" })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Browse jobs' })).toHaveAttribute('href', '/jobs');
    expect(screen.queryByRole('link', { name: 'Sign in to apply' })).toBeNull();
  });

  it('sends a signed-out reader into sign-in, and has it come back to this role', async () => {
    server.use(...signedOut(), ...showsJob(PUBLIC_JOB));

    const { user, router } = await renderApp(`/jobs/${PUBLIC_JOB.id}`);

    await user.click(await screen.findByRole('link', { name: 'Sign in to apply' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(router.state.location.search).toEqual({ returnTo: `/jobs/${PUBLIC_JOB.id}` });
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeVisible();
  });

  it('offers a signed-in candidate the apply action itself', async () => {
    server.use(...signedInAs(CANDIDATE), ...showsJob(PUBLIC_JOB));

    const { user } = await renderApp(`/jobs/${PUBLIC_JOB.id}`);

    await user.click(await screen.findByRole('button', { name: 'Apply' }));
    expect(
      screen.getByRole('radiogroup', { name: PUBLIC_JOB.questions[0]?.question_text }),
    ).toBeVisible();
    expect(screen.queryByRole('link', { name: 'Sign in to apply' })).toBeNull();
  });

  it('submits the answers and confirms the Application at the point of action', async () => {
    const submitted = vi.fn();
    server.use(
      ...signedInAs(CANDIDATE),
      ...showsJob(PUBLIC_JOB),
      ...acceptsApplication(APPLICATION, submitted),
    );

    const { user } = await renderApp(`/jobs/${PUBLIC_JOB.id}`);
    await user.click(await screen.findByRole('button', { name: 'Apply' }));
    await user.click(screen.getByRole('radio', { name: 'Yes' }));
    await user.type(
      screen.getByRole('textbox', { name: 'What is your notice period?' }),
      'Two weeks',
    );
    await user.click(screen.getByRole('button', { name: 'Submit application' }));

    await waitFor(() =>
      expect(submitted).toHaveBeenCalledWith({
        job_id: PUBLIC_JOB.id,
        answers: [
          { question_id: PUBLIC_JOB.questions[0]?.id, answer_boolean: true },
          { question_id: PUBLIC_JOB.questions[1]?.id, answer_text: 'Two weeks' },
        ],
      }),
    );
    expect(await screen.findByText('Application sent')).toBeVisible();
    expect(screen.getByRole('link', { name: 'View My Applications' })).toHaveAttribute(
      'href',
      '/applications',
    );
  });

  it('keeps a duplicate verdict beside the apply action', async () => {
    server.use(
      ...signedInAs(CANDIDATE),
      ...showsJob(PUBLIC_JOB),
      ...refusesApplication(DUPLICATE_APPLICATION),
    );

    const { user } = await renderApp(`/jobs/${PUBLIC_JOB.id}`);
    await user.click(await screen.findByRole('button', { name: 'Apply' }));
    await user.click(screen.getByRole('radio', { name: 'Yes' }));
    await user.click(screen.getByRole('button', { name: 'Submit application' }));

    expect(await screen.findByText(DUPLICATE_APPLICATION.detail as string)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Submit application' })).toBeVisible();
    expect(screen.queryByText('Application sent')).toBeNull();
  });

  it('puts a refused answer beside the question the server rejected', async () => {
    server.use(
      ...signedInAs(CANDIDATE),
      ...showsJob(PUBLIC_JOB),
      ...refusesApplicationAnswers(APPLICATION_ANSWER_REFUSED),
    );

    const { user } = await renderApp(`/jobs/${PUBLIC_JOB.id}`);
    await user.click(await screen.findByRole('button', { name: 'Apply' }));
    await user.click(screen.getByRole('radio', { name: 'Yes' }));
    await user.click(screen.getByRole('button', { name: 'Submit application' }));

    const answerError = await screen.findByText(
      APPLICATION_ANSWER_REFUSED.errors?.[0]?.message as string,
    );
    expect(screen.getByRole('radiogroup')).toHaveAttribute(
      'aria-describedby',
      expect.stringContaining(answerError.id),
    );
    expect(screen.queryByText(APPLICATION_ANSWER_REFUSED.detail as string)).toBeNull();
  });

  it('names the pending apply state and prevents a second submission', async () => {
    server.use(...signedInAs(CANDIDATE), ...showsJob(PUBLIC_JOB), ...withholdsApplication());

    const { user } = await renderApp(`/jobs/${PUBLIC_JOB.id}`);
    await user.click(await screen.findByRole('button', { name: 'Apply' }));
    await user.click(screen.getByRole('radio', { name: 'Yes' }));
    await user.click(screen.getByRole('button', { name: 'Submit application' }));

    expect(await screen.findByRole('button', { name: 'Submitting…' })).toBeDisabled();
  });

  it('keeps a server fault inside the page, with the shell still standing', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    server.use(...signedOut(), ...faultsOnJob(SERVER_FAULT));

    await renderApp(`/jobs/${PUBLIC_JOB.id}`);

    expect(await screen.findByText("This page didn't load")).toBeVisible();
    expect(screen.getByText(SERVER_FAULT.detail as string)).toBeVisible();
    expect(screen.getByRole('banner')).toBeVisible();
    // Not the app-shell boundary: nothing is wrong with Sync, only with this one page.
    expect(screen.queryByText("Sync didn't start")).toBeNull();
    expect(consoleError).toHaveBeenCalledWith('[route]', expect.objectContaining({ status: 500 }));
  });
});
