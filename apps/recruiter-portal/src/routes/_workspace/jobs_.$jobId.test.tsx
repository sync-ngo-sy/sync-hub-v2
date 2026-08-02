import type { components } from '@sync/api-client';
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { signedInAs } from '@/features/auth/testing/handlers';
import { FIELD_COORDINATOR_VIEW } from '@/features/jobs/testing/fixtures';
import { getsJob, replacesJobCriteria } from '@/features/jobs/testing/handlers';
import { failsToLoadCanonicalSkills } from '@/features/reference/testing/handlers';
import { RECRUITER, SERVER_FAULT } from '@/testing/fixtures';
import { renderApp } from '@/testing/render-app';
import { server } from '@/testing/server';

type JobView = components['schemas']['JobView'];
type JobCriteria = components['schemas']['JobCriteria'];

function entry(label: string) {
  return within(screen.getByRole('group', { name: label }));
}

/** The criteria tab, open and saveable — `sent.body` is the whole set the form put back. */
async function openCriteriaThatSaves(job: JobView) {
  const sent: { body?: JobCriteria } = {};
  server.use(
    ...signedInAs(RECRUITER),
    ...getsJob(job),
    ...replacesJobCriteria(job.criteria, (body) => {
      sent.body = body;
    }),
  );
  return { ...(await renderApp(`/jobs/${job.id}?tab=criteria`)), sent };
}

describe('a recruiter Job detail page', () => {
  it('loads the whole Job and keeps tab navigation in the URL', async () => {
    server.use(...signedInAs(RECRUITER), ...getsJob(FIELD_COORDINATOR_VIEW));

    const { router, user } = await renderApp(`/jobs/${FIELD_COORDINATOR_VIEW.id}?tab=criteria`);

    expect(
      await screen.findByRole('heading', { level: 1, name: FIELD_COORDINATOR_VIEW.title }),
    ).toBeVisible();
    expect(screen.getByText('Published')).toBeVisible();
    expect(screen.getByText('Aleppo')).toBeVisible();
    expect(screen.getByText('Full time')).toBeVisible();
    expect(screen.getByRole('tab', { name: 'Screening criteria' })).toHaveAttribute('data-active');
    expect(screen.getByRole('button', { name: 'Close job' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Archive job' })).toBeVisible();

    await user.click(screen.getByRole('tab', { name: 'Tracked links' }));

    await waitFor(() => expect(router.state.location.search).toEqual({ tab: 'links' }));
    expect(screen.getByText('Tracked links will appear here.')).toBeVisible();
  });

  it('says that saving replaces every criterion and sends the whole edited set', async () => {
    const onReplace = vi.fn();
    const job = {
      ...FIELD_COORDINATOR_VIEW,
      criteria: {
        minimum_total_experience_years: 3,
        skills: [{ name: 'Python', importance: 'required' as const, minimum_years: 2 }],
        languages: [{ code: 'en', minimum_proficiency: 'fluent' as const }],
        questions: [
          {
            id: '00000000-0000-4000-8000-000000000201',
            question_text: 'Can you travel weekly?',
            question_type: 'yes_no' as const,
            is_required: true,
            accepted_boolean_answer: true,
          },
        ],
      },
    };
    const replaced = {
      ...job.criteria,
      minimum_total_experience_years: 5,
      skills: [],
    };
    server.use(
      ...signedInAs(RECRUITER),
      ...getsJob(job),
      ...replacesJobCriteria(replaced, onReplace),
    );

    const { user } = await renderApp(`/jobs/${job.id}?tab=criteria`);

    expect(
      await screen.findByText(/Saving replaces the whole set of screening criteria/),
    ).toBeVisible();
    const experience = screen.getByLabelText('Minimum total experience');
    await user.clear(experience);
    await user.type(experience, '5');
    await user.click(screen.getByRole('button', { name: 'Remove Skill 1' }));
    await user.click(screen.getByRole('button', { name: 'Save screening criteria' }));

    await waitFor(() =>
      expect(onReplace).toHaveBeenCalledExactlyOnceWith({
        minimum_total_experience_years: 5,
        skills: [],
        languages: [{ code: 'en', minimum_proficiency: 'fluent' }],
        questions: [
          {
            question_text: 'Can you travel weekly?',
            question_type: 'yes_no',
            is_required: true,
            accepted_boolean_answer: true,
          },
        ],
      }),
    );
    expect(await screen.findByText('Screening criteria replaced')).toBeVisible();
  });

  it('shows a friendly not-found page for an unknown Job', async () => {
    server.use(...signedInAs(RECRUITER), ...getsJob(FIELD_COORDINATOR_VIEW));

    await renderApp('/jobs/00000000-0000-4000-8000-000000000999');

    expect(await screen.findByRole('heading', { name: 'Job not found' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Back to Jobs' })).toHaveAttribute('href', '/jobs');
    expect(screen.getByRole('banner')).toBeVisible();
  });

  it('removes passing-answer screening when a question becomes short text', async () => {
    const onReplace = vi.fn();
    const job = {
      ...FIELD_COORDINATOR_VIEW,
      criteria: {
        ...FIELD_COORDINATOR_VIEW.criteria,
        questions: [
          {
            id: '00000000-0000-4000-8000-000000000202',
            question_text: 'Can you start next month?',
            question_type: 'yes_no' as const,
            is_required: true,
            accepted_boolean_answer: true,
          },
        ],
      },
    };
    const replaced = {
      ...job.criteria,
      questions: [
        {
          id: '00000000-0000-4000-8000-000000000202',
          question_text: 'Can you start next month?',
          question_type: 'short_text' as const,
          is_required: true,
          accepted_boolean_answer: null,
        },
      ],
    };
    server.use(
      ...signedInAs(RECRUITER),
      ...getsJob(job),
      ...replacesJobCriteria(replaced, onReplace),
    );

    const { user } = await renderApp(`/jobs/${job.id}?tab=criteria`);
    await user.click(await screen.findByLabelText('Answer type'));
    await user.click(screen.getByRole('option', { name: 'Short answer' }));

    expect(screen.queryByLabelText('Passing answer')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save screening criteria' }));

    await waitFor(() =>
      expect(onReplace).toHaveBeenCalledWith(
        expect.objectContaining({
          questions: [
            {
              question_text: 'Can you start next month?',
              question_type: 'short_text',
              is_required: true,
              accepted_boolean_answer: null,
            },
          ],
        }),
      ),
    );
  });
});

const SCREENED_JOB: JobView = {
  ...FIELD_COORDINATOR_VIEW,
  criteria: {
    minimum_total_experience_years: null,
    skills: [{ name: 'Python', importance: 'required', minimum_years: 2 }],
    languages: [{ code: 'ar', minimum_proficiency: 'fluent' }],
    questions: [],
  },
};

describe("a Job's screening criteria", () => {
  it("offers the platform's skills by category, and saves the one chosen", async () => {
    const { user, sent } = await openCriteriaThatSaves(SCREENED_JOB);

    await user.click(screen.getByRole('button', { name: 'Add a skill' }));
    await user.click(entry('Skill 2').getByLabelText('Skill'));

    expect(await screen.findByText('Databases')).toBeVisible();
    expect(screen.getByText('Programming Languages')).toBeVisible();
    await user.click(screen.getByRole('option', { name: 'PostgreSQL' }));
    await user.click(screen.getByRole('button', { name: 'Save screening criteria' }));

    await waitFor(() =>
      expect(sent.body?.skills).toEqual([
        { name: 'Python', importance: 'required', minimum_years: 2 },
        { name: 'PostgreSQL', importance: 'preferred', minimum_years: null },
      ]),
    );
  });

  it("leaves the skills already on the Job's criteria out of the picker", async () => {
    const { user } = await openCriteriaThatSaves(SCREENED_JOB);

    await user.click(screen.getByRole('button', { name: 'Add a skill' }));
    await user.click(entry('Skill 2').getByLabelText('Skill'));

    expect(await screen.findByRole('option', { name: 'Go' })).toBeVisible();
    expect(screen.queryByRole('option', { name: 'Python' })).toBeNull();
  });

  it('reads a language by its name and saves it as its code', async () => {
    const { user, sent } = await openCriteriaThatSaves(SCREENED_JOB);

    expect(entry('Language 1').getByLabelText('Language')).toHaveValue('Arabic');

    await user.click(screen.getByRole('button', { name: 'Add a language' }));
    await user.click(entry('Language 2').getByLabelText('Language'));

    expect(await screen.findByRole('option', { name: 'English' })).toBeVisible();
    expect(screen.queryByRole('option', { name: 'Arabic' })).toBeNull();
    await user.click(screen.getByRole('option', { name: 'English' }));
    await user.click(screen.getByRole('button', { name: 'Save screening criteria' }));

    await waitFor(() =>
      expect(sent.body?.languages).toEqual([
        { code: 'ar', minimum_proficiency: 'fluent' },
        { code: 'en', minimum_proficiency: 'intermediate' },
      ]),
    );
  });

  it('will not let a skill or language the platform has no name for reach the API', async () => {
    const { user, sent } = await openCriteriaThatSaves(SCREENED_JOB);

    await user.type(entry('Skill 1').getByLabelText('Skill'), 'nn');
    await user.keyboard('{Escape}');
    await user.type(entry('Language 1').getByLabelText('Language'), 'bic');
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: 'Save screening criteria' }));

    await waitFor(() => expect(sent.body).toBeDefined());
    expect(sent.body?.skills).toEqual([
      { name: 'Python', importance: 'required', minimum_years: 2 },
    ]);
    expect(sent.body?.languages).toEqual([{ code: 'ar', minimum_proficiency: 'fluent' }]);
  });

  it('asks for a choice rather than a typed answer on an empty row', async () => {
    const { user, sent } = await openCriteriaThatSaves(SCREENED_JOB);

    await user.click(screen.getByRole('button', { name: 'Add a skill' }));
    await user.click(screen.getByRole('button', { name: 'Add a language' }));
    await user.click(screen.getByRole('button', { name: 'Save screening criteria' }));

    expect(await screen.findByText('Choose a skill.')).toBeVisible();
    expect(screen.getByText('Choose a language.')).toBeVisible();
    expect(sent.body).toBeUndefined();
  });

  it('leaves the pickers alone once an Application has locked the criteria', async () => {
    await openCriteriaThatSaves({ ...SCREENED_JOB, criteria_locked: true });

    expect(await screen.findByText('Screening criteria are locked')).toBeVisible();
    expect(entry('Skill 1').getByLabelText('Skill')).toBeDisabled();
    expect(entry('Language 1').getByLabelText('Language')).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Save screening criteria' })).toBeNull();
  });

  it('says the skill list is missing rather than that there are no skills', async () => {
    server.use(...failsToLoadCanonicalSkills(SERVER_FAULT));
    const { user } = await openCriteriaThatSaves(SCREENED_JOB);

    await user.click(screen.getByRole('button', { name: 'Add a skill' }));
    await user.click(entry('Skill 2').getByLabelText('Skill'));

    expect(
      await screen.findByText("The skill list couldn't be loaded.", { exact: false }),
    ).toBeVisible();
  });
});
