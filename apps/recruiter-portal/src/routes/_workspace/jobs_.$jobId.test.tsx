import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { signedInAs } from '@/features/auth/testing/handlers';
import { FIELD_COORDINATOR_VIEW } from '@/features/jobs/testing/fixtures';
import { getsJob, replacesJobCriteria } from '@/features/jobs/testing/handlers';
import { RECRUITER } from '@/testing/fixtures';
import { renderApp } from '@/testing/render-app';
import { server } from '@/testing/server';

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
