import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  acceptsApplication,
  faultsOnApplications,
  listsApplications,
  listsApplicationsInTurn,
  pagesApplications,
  refusesWithdrawal,
  withdrawsApplication,
  withholdsApplications,
  withholdsWithdrawal,
} from '@/features/applications/testing/handlers';
import { signedInAs } from '@/features/auth/testing/handlers';
import { showsJob } from '@/features/jobs/testing/handlers';
import { absoluteDateTime } from '@/lib/dates';
import {
  APPLICATION,
  CANDIDATE,
  INTERVIEW_APPLICATION,
  MORE_APPLICATIONS,
  PUBLIC_JOB,
  SERVER_FAULT,
  WITHDRAWAL_REFUSED,
} from '@/testing/fixtures';
import { renderApp } from '@/testing/render-app';
import { server } from '@/testing/server';

function cardFor(title: string): HTMLElement {
  const card = screen.getByRole('heading', { name: title }).closest('li');
  if (!card) throw new Error(`no Application card for ${title}`);
  return card;
}

describe('My Applications', () => {
  it('lists Applications newest-first with status chips and relative times', async () => {
    const recentApplication = {
      ...APPLICATION,
      applied_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1_000).toISOString(),
    };
    server.use(
      ...signedInAs(CANDIDATE),
      ...listsApplications([recentApplication, INTERVIEW_APPLICATION]),
    );

    await renderApp('/applications');

    const list = await screen.findByRole('list', { name: 'Your Applications' });
    expect(
      within(list)
        .getAllByRole('heading')
        .map((heading) => heading.textContent),
    ).toEqual([APPLICATION.job.title, INTERVIEW_APPLICATION.job.title]);

    const submitted = cardFor(recentApplication.job.title);
    expect(within(submitted).getByText('Submitted')).toBeVisible();
    expect(
      within(submitted).getByText('Levant Digital · Damascus · Remote · Full time'),
    ).toBeVisible();
    expect(within(submitted).getByText('14 days ago')).toHaveAttribute(
      'title',
      absoluteDateTime(recentApplication.applied_at),
    );

    expect(within(cardFor(INTERVIEW_APPLICATION.job.title)).getByText('Interview')).toBeVisible();
  });

  it('appends the next cursor page and keeps the first page in place', async () => {
    server.use(
      ...signedInAs(CANDIDATE),
      ...pagesApplications([[APPLICATION, INTERVIEW_APPLICATION], MORE_APPLICATIONS]),
    );

    const { user } = await renderApp('/applications');
    const list = await screen.findByRole('list', { name: 'Your Applications' });
    await user.click(screen.getByRole('button', { name: 'Load more' }));

    await waitFor(() => expect(within(list).getAllByRole('listitem')).toHaveLength(3));
    expect(within(list).getByRole('heading', { name: APPLICATION.job.title })).toBeVisible();
    expect(within(list).getByRole('heading', { name: 'Pharmacist' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull();
  });

  it('holds the page open with a list skeleton while the first page loads', async () => {
    server.use(...signedInAs(CANDIDATE), ...withholdsApplications());

    await renderApp('/applications');

    expect(screen.getByRole('heading', { name: 'My Applications' })).toBeVisible();
    expect(screen.getByRole('status', { name: 'Loading your Applications' })).toBeVisible();
    expect(screen.queryByRole('list', { name: 'Your Applications' })).toBeNull();
  });

  it('points an empty list to Browse', async () => {
    server.use(...signedInAs(CANDIDATE), ...listsApplications([]));

    await renderApp('/applications');

    expect(await screen.findByText(/No applications yet/)).toBeVisible();
    expect(screen.getByRole('link', { name: 'Browse jobs' })).toHaveAttribute('href', '/jobs');
    expect(screen.queryByRole('list', { name: 'Your Applications' })).toBeNull();
  });

  it('offers a retry when the list fails without dropping the page', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    server.use(...signedInAs(CANDIDATE), ...faultsOnApplications(SERVER_FAULT));

    const { user } = await renderApp('/applications');

    expect(await screen.findByText("Couldn't load your Applications")).toBeVisible();
    expect(screen.getByText(SERVER_FAULT.detail as string)).toBeVisible();
    expect(screen.getByRole('heading', { name: 'My Applications' })).toBeVisible();

    server.use(...listsApplications([APPLICATION]));
    await user.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByRole('list', { name: 'Your Applications' })).toBeVisible();
    expect(screen.queryByText("Couldn't load your Applications")).toBeNull();
    expect(consoleError).toHaveBeenCalledWith(
      '[widget: Applications]',
      expect.objectContaining({ status: 500 }),
    );
  });

  it('refreshes a previously visited list after a new Application is sent', async () => {
    server.use(
      ...signedInAs(CANDIDATE),
      ...listsApplicationsInTurn([], [APPLICATION]),
      ...showsJob(PUBLIC_JOB),
      ...acceptsApplication(APPLICATION),
    );

    const { router, user } = await renderApp('/applications');
    expect(await screen.findByText(/No applications yet/)).toBeVisible();

    await router.navigate({ to: '/jobs/$jobId', params: { jobId: PUBLIC_JOB.id } });
    await user.click(await screen.findByRole('button', { name: 'Apply' }));
    await user.click(screen.getByRole('radio', { name: 'Yes' }));
    await user.click(screen.getByRole('button', { name: 'Submit application' }));
    await user.click(await screen.findByRole('link', { name: 'View My Applications' }));

    expect(
      await screen.findByRole('heading', { name: APPLICATION.job.title, level: 2 }),
    ).toBeVisible();
    expect(screen.queryByText(/No applications yet/)).toBeNull();
  });

  it('withdraws only after naming that the decision is permanent', async () => {
    const targeted = vi.fn();
    const withdrawn = { ...APPLICATION, status: 'withdrawn' as const };
    server.use(
      ...signedInAs(CANDIDATE),
      ...listsApplicationsInTurn([APPLICATION], [withdrawn]),
      ...withdrawsApplication(
        {
          id: APPLICATION.id,
          status: 'withdrawn',
          previous_status: 'new',
          changed_at: '2026-08-01T14:00:00Z',
        },
        targeted,
      ),
    );

    const { user } = await renderApp('/applications');
    await user.click(
      await screen.findByRole('button', { name: `Withdraw from “${APPLICATION.job.title}”` }),
    );

    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText(APPLICATION.job.title)).toBeVisible();
    expect(within(dialog).getByText(/cannot be undone/i)).toBeVisible();
    expect(within(dialog).getByText(/cannot apply to this job again/i)).toBeVisible();
    await user.click(within(dialog).getByRole('button', { name: 'Withdraw for good' }));

    await waitFor(() => expect(targeted).toHaveBeenCalledWith(APPLICATION.id));
    expect(await within(cardFor(APPLICATION.job.title)).findByText('Withdrawn')).toBeVisible();
    expect(
      within(cardFor(APPLICATION.job.title)).queryByRole('button', { name: /Withdraw from/ }),
    ).toBeNull();
  });

  it('keeps withdrawal controls locked while the request is pending', async () => {
    server.use(
      ...signedInAs(CANDIDATE),
      ...listsApplications([APPLICATION]),
      ...withholdsWithdrawal(),
    );

    const { user } = await renderApp('/applications');
    await user.click(
      await screen.findByRole('button', { name: `Withdraw from “${APPLICATION.job.title}”` }),
    );
    await user.click(screen.getByRole('button', { name: 'Withdraw for good' }));

    expect(await screen.findByRole('button', { name: 'Withdrawing…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Keep application' })).toBeDisabled();
  });

  it('keeps a raced withdrawal rejection inside the confirmation', async () => {
    server.use(
      ...signedInAs(CANDIDATE),
      ...listsApplications([APPLICATION]),
      ...refusesWithdrawal(WITHDRAWAL_REFUSED),
    );

    const { user } = await renderApp('/applications');
    await user.click(
      await screen.findByRole('button', { name: `Withdraw from “${APPLICATION.job.title}”` }),
    );
    await user.click(screen.getByRole('button', { name: 'Withdraw for good' }));

    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText(WITHDRAWAL_REFUSED.detail as string)).toBeVisible();
    expect(within(dialog).getByRole('button', { name: 'Withdraw for good' })).toBeVisible();
  });
});
