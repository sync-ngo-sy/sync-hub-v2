import type { components } from '@sync/api-client';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { listsJobApplications } from '@/features/applications/testing/handlers';
import { signedInAs } from '@/features/auth/testing/handlers';
import { PROGRAMME_OFFICER_VIEW } from '@/features/jobs/testing/fixtures';
import {
  changesJob,
  createsJob,
  getsJob,
  refusesCriteriaReplacement,
  refusesJobChange,
  refusesJobCreation,
  replacesJobCriteria,
} from '@/features/jobs/testing/handlers';
import { RECRUITER } from '@/testing/fixtures';
import { renderApp } from '@/testing/render-app';
import { server } from '@/testing/server';

type JobCriteria = components['schemas']['JobCriteria'];
type ValidationProblem = components['schemas']['ValidationProblemDetail'];

const DRAFT = PROGRAMME_OFFICER_VIEW;
const PUBLISHED = { ...DRAFT, status: 'published' as const };
const NO_CRITERIA = DRAFT.criteria;

function entry(label: string) {
  return within(screen.getByRole('group', { name: label }));
}

async function typeDetails(user: UserEvent) {
  await user.type(screen.getByLabelText('Title'), 'Programme Officer');
  await user.type(screen.getByLabelText('Description'), 'Lead programme planning.');
}

async function next(user: UserEvent) {
  await user.click(screen.getByRole('button', { name: 'Next' }));
}

describe('the job creation wizard', () => {
  it('walks the recruiter through three steps and sends nothing on the way', async () => {
    const onCreate = vi.fn();
    server.use(...signedInAs(RECRUITER), ...createsJob(DRAFT, onCreate));

    const { user, router } = await renderApp('/jobs/new');

    expect(screen.getByRole('button', { name: 'Details' })).toHaveAttribute('aria-current', 'step');
    await typeDetails(user);
    await next(user);

    await waitFor(() => expect(router.state.location.search).toEqual({ step: 'screening' }));
    expect(await screen.findByRole('button', { name: 'Add a question' })).toBeVisible();
    await next(user);

    await waitFor(() => expect(router.state.location.search).toEqual({ step: 'review' }));
    expect(await screen.findByText('Programme Officer')).toBeVisible();
    expect(screen.getByText('Lead programme planning.')).toBeVisible();

    expect(onCreate).not.toHaveBeenCalled();
  });

  it('publishes the Job with its criteria and questions in one action', async () => {
    const onCreate = vi.fn();
    const onReplace = vi.fn();
    const onChange = vi.fn();
    server.use(
      ...signedInAs(RECRUITER),
      ...createsJob(DRAFT, onCreate),
      ...replacesJobCriteria(NO_CRITERIA, onReplace),
      ...changesJob(PUBLISHED, onChange),
      ...getsJob(PUBLISHED),
      ...listsJobApplications([]),
    );

    const { user, router } = await renderApp('/jobs/new');
    await typeDetails(user);
    await user.click(screen.getByLabelText('Location'));
    expect(await screen.findByText('Syria')).toBeVisible();
    await user.click(screen.getByRole('option', { name: 'Damascus' }));
    await next(user);

    await user.click(await screen.findByRole('button', { name: 'Add a skill' }));
    await user.click(entry('Skill 1').getByLabelText('Skill'));
    await user.click(await screen.findByRole('option', { name: 'Python' }));

    await user.click(screen.getByRole('button', { name: 'Add a question' }));
    await user.type(entry('Question 1').getByLabelText('Question'), 'Can you travel?');
    await next(user);

    await user.click(await screen.findByRole('button', { name: 'Publish' }));

    await waitFor(() =>
      expect(onCreate).toHaveBeenCalledExactlyOnceWith({
        title: 'Programme Officer',
        description: 'Lead programme planning.',
        location_key: 'sy-damascus',
        employment_type: null,
        work_mode: null,
        expires_at: null,
      }),
    );
    await waitFor(() =>
      expect(onReplace).toHaveBeenCalledExactlyOnceWith({
        minimum_total_experience_years: null,
        skills: [{ name: 'Python', importance: 'preferred', minimum_years: null }],
        languages: [],
        questions: [
          {
            question_text: 'Can you travel?',
            question_type: 'yes_no',
            is_required: true,
            accepted_boolean_answer: null,
          },
        ],
      } satisfies JobCriteria),
    );
    await waitFor(() => expect(onChange).toHaveBeenCalledExactlyOnceWith({ status: 'published' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(`/jobs/${DRAFT.id}`));
  });

  it('saves a draft from the Review step without publishing it', async () => {
    const onCreate = vi.fn();
    const onChange = vi.fn();
    server.use(
      ...signedInAs(RECRUITER),
      ...createsJob(DRAFT, onCreate),
      ...changesJob(DRAFT, onChange),
      ...getsJob(DRAFT),
      ...listsJobApplications([]),
    );

    const { user, router } = await renderApp('/jobs/new');
    await typeDetails(user);
    await next(user);
    await next(user);

    await user.click(await screen.findByRole('button', { name: 'Save as draft' }));

    await waitFor(() => expect(onCreate).toHaveBeenCalledOnce());
    await waitFor(() => expect(router.state.location.pathname).toBe(`/jobs/${DRAFT.id}`));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('leaves the criteria call out when the Job screens nobody', async () => {
    const onCreate = vi.fn();
    const onReplace = vi.fn();
    server.use(
      ...signedInAs(RECRUITER),
      ...createsJob(DRAFT, onCreate),
      ...replacesJobCriteria(NO_CRITERIA, onReplace),
      ...changesJob(DRAFT, vi.fn()),
      ...getsJob(DRAFT),
      ...listsJobApplications([]),
    );

    const { user } = await renderApp('/jobs/new');
    await typeDetails(user);
    await next(user);
    await next(user);
    await user.click(await screen.findByRole('button', { name: 'Save as draft' }));

    await waitFor(() => expect(onCreate).toHaveBeenCalledOnce());
    expect(onReplace).not.toHaveBeenCalled();
  });

  it('restores what was entered after a refresh', async () => {
    server.use(...signedInAs(RECRUITER));

    const first = await renderApp('/jobs/new');
    await typeDetails(first.user);
    await next(first.user);
    await waitFor(() => expect(first.router.state.location.search).toEqual({ step: 'screening' }));
    await first.user.click(await screen.findByRole('button', { name: 'Add a question' }));
    await first.user.type(entry('Question 1').getByLabelText('Question'), 'Can you travel?');

    cleanup();
    await renderApp('/jobs/new?step=screening');

    expect(await screen.findByLabelText('Question')).toHaveValue('Can you travel?');
  });

  it('brings back a half-typed draft, not only a finished one', async () => {
    server.use(...signedInAs(RECRUITER));

    const first = await renderApp('/jobs/new');
    await first.user.type(screen.getByLabelText('Title'), 'Programme Off');

    cleanup();
    await renderApp('/jobs/new');

    expect(await screen.findByLabelText('Title')).toHaveValue('Programme Off');
    expect(screen.getByLabelText('Description')).toHaveValue('');
  });

  it('keeps a half-filled screening entry rather than dropping the whole step', async () => {
    server.use(...signedInAs(RECRUITER));

    const first = await renderApp('/jobs/new');
    await typeDetails(first.user);
    await next(first.user);
    await first.user.click(await screen.findByRole('button', { name: 'Add a question' }));
    await first.user.type(entry('Question 1').getByLabelText('Question'), 'Can you tra');
    await first.user.click(screen.getByRole('button', { name: 'Add a skill' }));

    cleanup();
    await renderApp('/jobs/new?step=screening');

    expect(await screen.findByLabelText('Question')).toHaveValue('Can you tra');
    expect(entry('Skill 1').getByLabelText('Skill')).toHaveValue('');
  });

  it('corrects the address when it asks for a step the draft cannot reach', async () => {
    server.use(...signedInAs(RECRUITER));

    const { router } = await renderApp('/jobs/new?step=review');

    await waitFor(() => expect(router.state.location.search).toEqual({ step: 'details' }));
  });

  it('drops the recruiter on the Screening tab when only the criteria failed to save', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...createsJob(DRAFT),
      ...getsJob(DRAFT),
      ...listsJobApplications([]),
      ...refusesCriteriaReplacement({
        type: 'urn:sync:problem:conflict',
        title: 'Conflict',
        status: 409,
        detail: 'These screening criteria were not accepted.',
      }),
    );

    const { user, router } = await renderApp('/jobs/new');
    await typeDetails(user);
    await next(user);
    await user.click(await screen.findByRole('button', { name: 'Add a question' }));
    await user.type(entry('Question 1').getByLabelText('Question'), 'Can you travel?');
    await next(user);
    await user.click(await screen.findByRole('button', { name: 'Publish' }));

    expect(await screen.findByText('These screening criteria were not accepted.')).toBeVisible();
    await waitFor(() => expect(router.state.location.pathname).toBe(`/jobs/${DRAFT.id}`));
    await waitFor(() => expect(router.state.location.search).toEqual({ tab: 'criteria' }));
  });

  it('keeps the recruiter on Details until the Job has a title and a description', async () => {
    const onCreate = vi.fn();
    server.use(...signedInAs(RECRUITER), ...createsJob(DRAFT, onCreate));

    const { user, router } = await renderApp('/jobs/new');
    await next(user);

    expect(await screen.findByText('Enter a job title.')).toBeVisible();
    expect(screen.getByText('Enter a job description.')).toBeVisible();
    expect(router.state.location.search).toEqual({});
    expect(onCreate).not.toHaveBeenCalled();
  });

  it('sends a deep link to a later step back to the first unfinished one', async () => {
    server.use(...signedInAs(RECRUITER));

    await renderApp('/jobs/new?step=review');

    expect(await screen.findByLabelText('Title')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Details' })).toHaveAttribute('aria-current', 'step');
  });

  it('offers employment type and work mode as fixed sets, never as text boxes', async () => {
    server.use(...signedInAs(RECRUITER));

    const { user } = await renderApp('/jobs/new');

    for (const [field, choices] of [
      [
        'Employment type',
        ['Full time', 'Part time', 'Contract', 'Temporary', 'Internship', 'Volunteer'],
      ],
      ['Work mode', ['On-site', 'Hybrid', 'Remote']],
    ] as const) {
      const control = screen.getByLabelText(field);
      expect(control.tagName).not.toBe('INPUT');
      await user.click(control);
      const offered = await screen.findAllByRole('option');
      expect(offered.map((option) => option.textContent)).toEqual(['Not set', ...choices]);
      await user.keyboard('{Escape}');
    }
  });

  it('puts a server rejection beneath the Details field it names', async () => {
    const rejected: ValidationProblem = {
      type: 'urn:sync:problem:validation',
      title: 'Invalid request',
      status: 422,
      detail: 'One field needs attention.',
      errors: [
        {
          location: 'body.title',
          message: 'A Job with this title already exists.',
          type: 'value_error',
        },
      ],
    };
    server.use(...signedInAs(RECRUITER), ...refusesJobCreation(rejected));

    const { user, router } = await renderApp('/jobs/new');
    await typeDetails(user);
    await next(user);
    await next(user);
    await user.click(await screen.findByRole('button', { name: 'Publish' }));

    expect(await screen.findByText('A Job with this title already exists.')).toBeVisible();
    await waitFor(() => expect(router.state.location.search).toEqual({ step: 'details' }));
  });

  it('puts a rejection of either fixed set beneath the field it names', async () => {
    const rejected: ValidationProblem = {
      type: 'urn:sync:problem:validation',
      title: 'Invalid request',
      status: 422,
      detail: 'Two fields need attention.',
      errors: [
        {
          location: 'body.employment_type',
          message: 'That is not an employment type.',
          type: 'enum',
        },
        { location: 'body.work_mode', message: 'That is not a work mode.', type: 'enum' },
      ],
    };
    server.use(...signedInAs(RECRUITER), ...refusesJobCreation(rejected));

    const { user } = await renderApp('/jobs/new');
    await typeDetails(user);
    await next(user);
    await next(user);
    await user.click(await screen.findByRole('button', { name: 'Save as draft' }));

    expect(await screen.findByText('That is not an employment type.')).toBeVisible();
    expect(screen.getByText('That is not a work mode.')).toBeVisible();
    expect(screen.queryByText("This Job couldn't be saved.")).not.toBeInTheDocument();
  });

  it('says so plainly when the Job was created but could not be published', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...createsJob(DRAFT),
      ...getsJob(DRAFT),
      ...listsJobApplications([]),
      ...refusesJobChange({
        type: 'urn:sync:problem:conflict',
        title: 'Conflict',
        status: 409,
        detail: 'This Job cannot be published yet.',
      }),
    );

    const { user, router } = await renderApp('/jobs/new');
    await typeDetails(user);
    await next(user);
    await next(user);
    await user.click(await screen.findByRole('button', { name: 'Publish' }));

    expect(await screen.findByText('This Job cannot be published yet.')).toBeVisible();
    await waitFor(() => expect(router.state.location.pathname).toBe(`/jobs/${DRAFT.id}`));
  });
});
