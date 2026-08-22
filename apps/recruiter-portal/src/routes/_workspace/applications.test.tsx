import { screen, waitFor, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OPEN_STATUSES, SCREENING_VERDICTS } from '@/features/applications/application';
import {
  AMAL_REVIEW,
  ANYWHERE_JOB,
  DIMA,
  DIMA_REVIEW,
  ELIAS,
  FARAH,
  GHADA,
  HANI,
} from '@/features/applications/testing/fixtures';
import {
  failsToListTenantApplications,
  getsApplication,
  listsTenantApplications,
  movesTenantApplications,
  movesTickedApplications,
  pagesTenantApplications,
  type TenantAskedFor,
} from '@/features/applications/testing/handlers';
import { signedInAs } from '@/features/auth/testing/handlers';
import { A_BUSY_WEEK } from '@/features/dashboard/testing/fixtures';
import { countsApplications, servesStats } from '@/features/dashboard/testing/handlers';
import { FIELD_COORDINATOR_VIEW } from '@/features/jobs/testing/fixtures';
import { getsJob, listsJobs } from '@/features/jobs/testing/handlers';
import { absoluteDateTime, relativeTime } from '@/lib/dates';
import { RECRUITER, SERVER_FAULT, TODAY } from '@/testing/fixtures';
import { renderApp } from '@/testing/render-app';
import { server } from '@/testing/server';

const EVERY_VERDICT = [...SCREENING_VERDICTS];

const STILL_OPEN = [...OPEN_STATUSES];

const EVERYONE = [DIMA, FARAH, ELIAS, GHADA, HANI];

function inUrl(chosen: readonly string[]) {
  return encodeURIComponent(JSON.stringify(chosen));
}

function rowOf(candidate: string) {
  return within(screen.getByRole('row', { name: new RegExp(candidate) }));
}

function pipelineChip(label: string) {
  return screen.getByRole('radio', { name: new RegExp(`^${label}(?: |$)`) });
}

function verdictTrigger() {
  return screen.getByRole('button', { name: /^Screening: / });
}

async function openVerdicts(user: UserEvent) {
  await user.click(verdictTrigger());
  await screen.findByRole('menu');
}

function checkItem(label: string) {
  return screen.getByRole('menuitemcheckbox', { name: new RegExp(`^${label}`) });
}

function rangeTrigger() {
  return screen.getByRole('combobox', { name: 'Received' });
}

function receivedHeader() {
  return screen.getByRole('button', { name: 'Received' });
}

function namesInOrder() {
  return screen
    .getAllByRole('link', { name: /Application$/ })
    .map((row) => row.getAttribute('aria-label'));
}

describe('the unified Applications page', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(TODAY);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('replaces the placeholder with every Application the Tenant has', async () => {
    server.use(...signedInAs(RECRUITER), ...listsTenantApplications(EVERYONE));

    await renderApp('/applications?pipeline=all');

    expect(await screen.findByRole('heading', { level: 1, name: 'Applications' })).toBeVisible();
    expect(screen.queryByText(/arrives with its own ticket/)).toBeNull();
    expect(screen.getByText('Dima Sabbagh')).toBeVisible();
    expect(screen.getByText('Farah Doumani')).toBeVisible();
    expect(screen.getByText('Hani Barakat')).toBeVisible();
  });

  it('is where the sidebar entry goes', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...servesStats(A_BUSY_WEEK),
      ...listsJobs([]),
      ...listsTenantApplications(EVERYONE),
    );

    const { router, user } = await renderApp('/dashboard');
    await user.click(
      within(screen.getByRole('navigation', { name: 'Workspace' })).getByRole('link', {
        name: 'Applications',
      }),
    );

    expect(await screen.findByRole('heading', { level: 1, name: 'Applications' })).toBeVisible();
    expect(router.state.location.pathname).toBe('/applications');
  });

  it('carries the same marks and received time as the Triage list, plus the Job', async () => {
    server.use(...signedInAs(RECRUITER), ...listsTenantApplications(EVERYONE));

    await renderApp('/applications');
    expect(await screen.findByText('Dima Sabbagh')).toBeVisible();

    expect(rowOf('Dima Sabbagh').getByText('Qualified')).toBeVisible();
    expect(rowOf('Dima Sabbagh').getByText('New')).toBeVisible();
    expect(rowOf('Dima Sabbagh').getByRole('link', { name: /MEAL Officer/ })).toBeVisible();
    expect(rowOf('Farah Doumani').getByRole('link', { name: /Field Coordinator/ })).toBeVisible();
    expect(rowOf('Dima Sabbagh').getByText(relativeTime(DIMA.applied_at))).toHaveAttribute(
      'title',
      absoluteDateTime(DIMA.applied_at),
    );
  });

  it('reads a Job open to Anywhere as Anywhere, rather than as no place at all', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...listsTenantApplications([{ ...DIMA, job: ANYWHERE_JOB }]),
    );

    await renderApp('/applications');
    expect(await screen.findByText('Dima Sabbagh')).toBeVisible();

    expect(rowOf('Dima Sabbagh').getByText('Anywhere')).toBeVisible();
  });

  it('takes the reader from the Job column to the Job itself', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...listsTenantApplications(EVERYONE),
      ...getsJob(FIELD_COORDINATOR_VIEW),
    );

    const { router, user } = await renderApp('/applications');
    await user.click(
      await rowOf('Farah Doumani').findByRole('link', { name: /Field Coordinator/ }),
    );

    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`/jobs/${FIELD_COORDINATOR_VIEW.id}`),
    );
  });

  it('takes the reader to the Application the row stands for', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...listsTenantApplications(EVERYONE),
      ...getsApplication(AMAL_REVIEW),
    );

    const { router, user } = await renderApp('/applications');
    await user.click(await screen.findByRole('link', { name: "Open Dima Sabbagh's Application" }));

    await waitFor(() => expect(router.state.location.pathname).toBe(`/applications/${DIMA.id}`));
  });

  it('opens on Open, asking for new through offer, every verdict, all time and newest first', async () => {
    const asked: TenantAskedFor[] = [];
    server.use(...signedInAs(RECRUITER), ...listsTenantApplications(EVERYONE, asked));

    const { router } = await renderApp('/applications');

    expect(await screen.findByText('Dima Sabbagh')).toBeVisible();
    expect(screen.getByText('Elias Murad')).toBeVisible();
    expect(asked.every((one) => one.status.join() === STILL_OPEN.join())).toBe(true);
    expect(asked.every((one) => one.qualification_status.join() === EVERY_VERDICT.join())).toBe(
      true,
    );
    expect(asked.every((one) => one.received_within === null)).toBe(true);
    expect(asked.every((one) => one.sort === 'newest')).toBe(true);
    expect(pipelineChip('Open')).toBeChecked();
    expect(verdictTrigger()).toHaveAccessibleName('Screening: All verdicts');
    expect(rangeTrigger()).toHaveTextContent('All time');
    expect(router.state.location.search).toEqual({});
  });

  it('leaves the Applications that have ended off the list it opens', async () => {
    server.use(...signedInAs(RECRUITER), ...listsTenantApplications(EVERYONE));

    await renderApp('/applications');

    expect(await screen.findByText('Dima Sabbagh')).toBeVisible();
    expect(screen.queryByText('Ghada Kanaan')).toBeNull();
    expect(screen.queryByText('Hani Barakat')).toBeNull();
  });

  it('holds every terminal Application on the tab each of them keeps', async () => {
    server.use(...signedInAs(RECRUITER), ...listsTenantApplications(EVERYONE));

    const { user } = await renderApp('/applications');
    expect(await screen.findByText('Dima Sabbagh')).toBeVisible();

    await user.click(pipelineChip('Hired'));
    expect(await screen.findByText('Hani Barakat')).toBeVisible();
    expect(screen.queryByText('Dima Sabbagh')).toBeNull();

    await user.click(pipelineChip('Rejected'));
    expect(await screen.findByText('Ghada Kanaan')).toBeVisible();

    await user.click(pipelineChip('All'));
    expect(await screen.findByText('Hani Barakat')).toBeVisible();
    expect(screen.getByText('Ghada Kanaan')).toBeVisible();
    expect(screen.getByText('Dima Sabbagh')).toBeVisible();
  });

  it('shows stable backend totals beside every Pipeline chip', async () => {
    server.use(...signedInAs(RECRUITER), ...listsTenantApplications(EVERYONE));

    await renderApp('/applications');
    expect(await screen.findByText('Dima Sabbagh')).toBeVisible();

    expect(pipelineChip('Open')).toHaveAccessibleName('Open 3');
    expect(pipelineChip('All')).toHaveAccessibleName('All 5');
    expect(pipelineChip('New')).toHaveAccessibleName('New 2');
    expect(pipelineChip('Reviewing')).toHaveAccessibleName('Reviewing 1');
    expect(pipelineChip('Rejected')).toHaveAccessibleName('Rejected 1');
    expect(pipelineChip('Withdrawn')).toHaveAccessibleName('Withdrawn 0');
  });

  it('moves to one Pipeline chip and writes it into the address bar', async () => {
    const asked: TenantAskedFor[] = [];
    server.use(...signedInAs(RECRUITER), ...listsTenantApplications(EVERYONE, asked));

    const { router, user } = await renderApp('/applications');
    expect(await screen.findByText('Dima Sabbagh')).toBeVisible();

    await user.click(pipelineChip('Rejected'));

    await waitFor(() => expect(router.state.location.search).toEqual({ pipeline: 'rejected' }));
    await waitFor(() => expect(asked.at(-1)?.status).toEqual(['rejected']));
    expect(await screen.findByText('Ghada Kanaan')).toBeVisible();
    expect(screen.queryByText('Dima Sabbagh')).toBeNull();
  });

  it('points the Hired tab at the Placements, and leaves the tab itself as it was', async () => {
    const asked: TenantAskedFor[] = [];
    server.use(...signedInAs(RECRUITER), ...listsTenantApplications(EVERYONE, asked));

    const { user } = await renderApp('/applications');
    expect(await screen.findByText('Dima Sabbagh')).toBeVisible();

    await user.click(pipelineChip('Hired'));

    const note = await screen.findByText(/Hired counts every hire your team has claimed/);
    expect(within(note).getByRole('link', { name: 'Placements' })).toHaveAttribute(
      'href',
      '/placements',
    );
    await waitFor(() => expect(asked.at(-1)?.status).toEqual(['hired']));
    expect(namesInOrder()).toEqual(["Open Hani Barakat's Application"]);
  });

  it('says nothing about Placements on a tab that is not Hired', async () => {
    server.use(...signedInAs(RECRUITER), ...listsTenantApplications(EVERYONE));

    await renderApp('/applications?pipeline=rejected');

    expect(await screen.findByText('Ghada Kanaan')).toBeVisible();
    expect(screen.queryByText(/Hired counts every hire your team has claimed/)).toBeNull();
  });

  it('narrows the list to a rolling window and writes it into the address bar', async () => {
    const asked: TenantAskedFor[] = [];
    server.use(...signedInAs(RECRUITER), ...listsTenantApplications(EVERYONE, asked));

    const { router, user } = await renderApp('/applications?pipeline=all');
    expect(await screen.findByText('Hani Barakat')).toBeVisible();

    await user.click(rangeTrigger());
    await user.click(await screen.findByRole('option', { name: 'Last 30 days' }));

    await waitFor(() =>
      expect(router.state.location.search).toEqual({ pipeline: 'all', received: '30d' }),
    );
    await waitFor(() => expect(asked.at(-1)?.received_within).toBe('30d'));
    expect(screen.queryByText('Hani Barakat')).toBeNull();
    expect(screen.getByText('Dima Sabbagh')).toBeVisible();
  });

  it('leaves the window out of the address bar when it is back to all time', async () => {
    server.use(...signedInAs(RECRUITER), ...listsTenantApplications(EVERYONE));

    const { router, user } = await renderApp(`/applications?pipeline=all&received=24h`);
    expect(await screen.findByText('Dima Sabbagh')).toBeVisible();

    await user.click(rangeTrigger());
    await user.click(await screen.findByRole('option', { name: 'All time' }));

    await waitFor(() => expect(router.state.location.search).toEqual({ pipeline: 'all' }));
    expect(await screen.findByText('Hani Barakat')).toBeVisible();
  });

  it('counts the Pipeline chips over the window the reader is looking at', async () => {
    server.use(...signedInAs(RECRUITER), ...listsTenantApplications(EVERYONE));

    await renderApp(`/applications?received=24h`);
    expect(await screen.findByText('Dima Sabbagh')).toBeVisible();

    expect(pipelineChip('New')).toHaveAccessibleName('New 1');
    expect(pipelineChip('Reviewing')).toHaveAccessibleName('Reviewing 0');
    expect(pipelineChip('Hired')).toHaveAccessibleName('Hired 0');
  });

  it('counts every verdict, including the ones the filter is hiding', async () => {
    server.use(...signedInAs(RECRUITER), ...listsTenantApplications(EVERYONE));

    const { user } = await renderApp(
      `/applications?pipeline=all&screening=${inUrl(['qualified'])}`,
    );
    expect(await screen.findByText('Dima Sabbagh')).toBeVisible();

    await openVerdicts(user);

    expect(checkItem('Qualified')).toHaveAccessibleName('Qualified, 3');
    expect(checkItem('Pending')).toHaveAccessibleName('Pending, 1');
    expect(checkItem('Disqualified')).toHaveAccessibleName('Disqualified, 1');
    expect(checkItem('Review required')).toHaveAccessibleName('Review required, 0');
  });

  it('counts the verdicts as the tab it opens on leaves them', async () => {
    server.use(...signedInAs(RECRUITER), ...listsTenantApplications(EVERYONE));

    const { user } = await renderApp('/applications');
    expect(await screen.findByText('Dima Sabbagh')).toBeVisible();

    await openVerdicts(user);

    expect(checkItem('Qualified')).toHaveAccessibleName('Qualified, 2');
    expect(checkItem('Pending')).toHaveAccessibleName('Pending, 1');
    expect(checkItem('Disqualified')).toHaveAccessibleName('Disqualified, 0');
  });

  it('narrows the list to one verdict and writes it into the address bar', async () => {
    const asked: TenantAskedFor[] = [];
    server.use(...signedInAs(RECRUITER), ...listsTenantApplications(EVERYONE, asked));

    const { router, user } = await renderApp('/applications');
    expect(await screen.findByText('Elias Murad')).toBeVisible();

    await openVerdicts(user);
    await user.click(checkItem('Pending'));

    await waitFor(() =>
      expect(router.state.location.search).toEqual({
        screening: EVERY_VERDICT.filter((verdict) => verdict !== 'pending'),
      }),
    );
    await waitFor(() => expect(asked.at(-1)?.qualification_status).not.toContain('pending'));
    expect(screen.queryByText('Elias Murad')).toBeNull();
    expect(screen.getByText('Dima Sabbagh')).toBeVisible();
  });

  it('turns the Received column around and asks the API for the other end', async () => {
    const asked: TenantAskedFor[] = [];
    server.use(...signedInAs(RECRUITER), ...listsTenantApplications(EVERYONE, asked));

    const { router, user } = await renderApp('/applications');
    expect(await screen.findByText('Dima Sabbagh')).toBeVisible();
    expect(namesInOrder()[0]).toBe("Open Dima Sabbagh's Application");

    await user.click(receivedHeader());

    await waitFor(() => expect(router.state.location.search).toEqual({ sort: 'oldest' }));
    await waitFor(() => expect(asked.at(-1)?.sort).toBe('oldest'));
    expect(namesInOrder()[0]).toBe("Open Elias Murad's Application");
  });

  it('leaves newest first out of the address bar when the column turns back', async () => {
    server.use(...signedInAs(RECRUITER), ...listsTenantApplications(EVERYONE));

    const { router, user } = await renderApp('/applications?sort=oldest');
    expect(await screen.findByText('Elias Murad')).toBeVisible();

    await user.click(receivedHeader());

    await waitFor(() => expect(router.state.location.search).toEqual({}));
    expect(namesInOrder()[0]).toBe("Open Dima Sabbagh's Application");
  });

  it('reproduces the list a shared link was copied from', async () => {
    const asked: TenantAskedFor[] = [];
    server.use(...signedInAs(RECRUITER), ...listsTenantApplications(EVERYONE, asked));

    await renderApp(
      `/applications?pipeline=rejected&screening=${inUrl(['disqualified'])}&received=7d&sort=oldest`,
    );

    expect(await screen.findByText('Ghada Kanaan')).toBeVisible();
    expect(screen.queryByText('Dima Sabbagh')).toBeNull();
    expect(pipelineChip('Rejected')).toBeChecked();
    expect(verdictTrigger()).toHaveAccessibleName('Screening: Disqualified');
    expect(rangeTrigger()).toHaveTextContent('Last 7 days');
    expect(asked.every((one) => one.status.join() === 'rejected')).toBe(true);
    expect(asked.every((one) => one.qualification_status.join() === 'disqualified')).toBe(true);
    expect(asked.every((one) => one.received_within === '7d')).toBe(true);
    expect(asked.every((one) => one.sort === 'oldest')).toBe(true);
  });

  it('drops filters the platform cannot honour rather than failing the page', async () => {
    const asked: TenantAskedFor[] = [];
    server.use(...signedInAs(RECRUITER), ...listsTenantApplications(EVERYONE, asked));

    await renderApp(
      '/applications?pipeline=on-a-yacht&screening=vibes&received=since-tuesday&sort=alphabetically',
    );

    expect(await screen.findByText('Dima Sabbagh')).toBeVisible();
    expect(asked.every((one) => one.status.join() === STILL_OPEN.join())).toBe(true);
    expect(asked.every((one) => one.qualification_status.join() === EVERY_VERDICT.join())).toBe(
      true,
    );
    expect(asked.every((one) => one.received_within === null)).toBe(true);
    expect(asked.every((one) => one.sort === 'newest')).toBe(true);
  });

  it('says a filtered view is empty because of the filters, and offers to drop them', async () => {
    server.use(...signedInAs(RECRUITER), ...listsTenantApplications(EVERYONE));

    const { router, user } = await renderApp('/applications?pipeline=hired&received=24h');

    expect(await screen.findByText('No Application matches these filters.')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Clear filters' }));

    await waitFor(() => expect(router.state.location.search).toEqual({}));
    expect(await screen.findByText('Dima Sabbagh')).toBeVisible();
  });

  it('says which single filter emptied the list when only one is narrowing', async () => {
    server.use(...signedInAs(RECRUITER), ...listsTenantApplications(EVERYONE));

    const { user } = await renderApp(`/applications?screening=${inUrl(['review_required'])}`);

    expect(await screen.findByText('No Application matches that filter.')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Clear filter' }));

    expect(await screen.findByText('Dima Sabbagh')).toBeVisible();
  });

  it('counts the filters from what was asked for, not from the counts the API sent', async () => {
    server.use(...signedInAs(RECRUITER), ...listsTenantApplications(EVERYONE));

    const { user } = await renderApp(
      `/applications?pipeline=hired&screening=${inUrl(['review_required'])}`,
    );

    expect(await screen.findByText('No Application matches these filters.')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Clear filters' }));

    expect(await screen.findByText('Dima Sabbagh')).toBeVisible();
  });

  it('points a Tenant nobody has applied to at its Jobs', async () => {
    server.use(...signedInAs(RECRUITER), ...listsTenantApplications([]));

    const { user } = await renderApp('/applications');

    expect(await screen.findByText(/No Applications yet/)).toBeVisible();

    await user.click(screen.getByRole('link', { name: 'Go to your jobs' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Jobs' })).toBeVisible();
  });

  it('tells a Tenant whose every Application ended, and leads to where they are', async () => {
    server.use(...signedInAs(RECRUITER), ...listsTenantApplications([GHADA, HANI]));

    const { router, user } = await renderApp('/applications');

    expect(
      await screen.findByText(
        'Nothing is waiting on a decision — every Application this Tenant received has ended.',
      ),
    ).toBeVisible();
    expect(screen.queryByRole('link', { name: 'Go to your jobs' })).toBeNull();
    expect(pipelineChip('Rejected')).toHaveAccessibleName('Rejected 1');

    await user.click(screen.getByRole('button', { name: 'Go to all Applications' }));

    await waitFor(() => expect(router.state.location.search).toEqual({ pipeline: 'all' }));
    expect(await screen.findByText('Ghada Kanaan')).toBeVisible();
    expect(screen.getByText('Hani Barakat')).toBeVisible();
  });

  it('fetches the next cursor page on demand', async () => {
    server.use(...signedInAs(RECRUITER), ...pagesTenantApplications([[DIMA], [FARAH]]));

    const { user } = await renderApp('/applications');

    expect(await screen.findByText('Dima Sabbagh')).toBeVisible();
    expect(screen.queryByText('Farah Doumani')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Load more' }));

    expect(await screen.findByText('Farah Doumani')).toBeVisible();
    expect(screen.getByText('2 shown')).toBeVisible();
  });

  it('reports a failed list inline and reloads it on retry', async () => {
    server.use(...signedInAs(RECRUITER), ...failsToListTenantApplications(SERVER_FAULT));

    const { user } = await renderApp('/applications');

    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong on our side.');

    server.use(...listsTenantApplications(EVERYONE));
    await user.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByText('Dima Sabbagh')).toBeVisible();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('a Pipeline move made from the Applications page', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(TODAY);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function awaitingReview() {
    return within(screen.getByRole('region', { name: 'Hiring at a glance' }))
      .getByText('Awaiting review')
      .closest('a');
  }

  function recentRow(candidate: string) {
    return within(
      within(screen.getByRole('region', { name: 'Recent applications' })).getByRole('row', {
        name: new RegExp(candidate),
      }),
    );
  }

  it('leaves the Pipeline tabs, the Verdict counts and the Dashboard saying where it went', async () => {
    const tenant = [DIMA, FARAH, ELIAS];
    server.use(
      ...signedInAs(RECRUITER),
      ...movesTenantApplications(tenant, DIMA_REVIEW),
      ...countsApplications(tenant, A_BUSY_WEEK),
    );

    const { router, user } = await renderApp('/dashboard');
    await waitFor(() => expect(awaitingReview()).toHaveTextContent('2'));
    expect(recentRow('Dima Sabbagh').getByText('New')).toBeVisible();

    await router.navigate({ to: '/applications', search: { pipeline: 'new' } });
    expect(await screen.findByText('Dima Sabbagh')).toBeVisible();
    expect(pipelineChip('New')).toHaveAccessibleName('New 2');
    expect(pipelineChip('Reviewing')).toHaveAccessibleName('Reviewing 1');

    await user.click(screen.getByRole('link', { name: "Open Dima Sabbagh's Application" }));
    await user.click(await screen.findByRole('button', { name: 'Move to Reviewing' }));
    expect(await screen.findByText(/Moved to Reviewing/)).toBeVisible();

    await router.navigate({ to: '/applications', search: { pipeline: 'new' } });

    expect(await screen.findByText('Farah Doumani')).toBeVisible();
    await waitFor(() => expect(pipelineChip('New')).toHaveAccessibleName('New 1'));
    expect(pipelineChip('Reviewing')).toHaveAccessibleName('Reviewing 2');
    expect(screen.queryByText('Dima Sabbagh')).toBeNull();

    await openVerdicts(user);
    expect(checkItem('Qualified')).toHaveAccessibleName('Qualified, 1');
    await user.keyboard('{Escape}');

    await router.navigate({ to: '/dashboard' });

    await waitFor(() => expect(awaitingReview()).toHaveTextContent('1'));
    expect(recentRow('Dima Sabbagh').getByText('Reviewing')).toBeVisible();
  });
});

describe('the ticks on the Tenant-wide Applications page', () => {
  function tickOf(candidate: string) {
    return screen.getByRole('checkbox', { name: `Tick ${candidate}'s Application` });
  }

  it('offers a tick on every row an act reaches, and none on one nothing moves', async () => {
    server.use(...signedInAs(RECRUITER), ...listsTenantApplications(EVERYONE));

    await renderApp('/applications?pipeline=all');
    expect(await screen.findByText('Dima Sabbagh')).toBeVisible();

    expect(tickOf('Dima Sabbagh')).toBeInTheDocument();
    expect(tickOf('Elias Murad')).toBeInTheDocument();
    expect(tickOf('Ghada Kanaan')).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: "Tick Hani Barakat's Application" })).toBeNull();
  });

  it('lets the first tick decide the act, and takes the box off every row that means the other', async () => {
    server.use(...signedInAs(RECRUITER), ...listsTenantApplications(EVERYONE));

    const { user } = await renderApp('/applications?pipeline=all');
    expect(await screen.findByText('Dima Sabbagh')).toBeVisible();

    await user.click(tickOf('Dima Sabbagh'));

    expect(screen.getByRole('button', { name: 'End 1 Application' })).toBeVisible();
    expect(tickOf('Farah Doumani')).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: "Tick Ghada Kanaan's Application" })).toBeNull();
  });

  it('offers no box that ticks every row at once', async () => {
    server.use(...signedInAs(RECRUITER), ...listsTenantApplications(EVERYONE));

    await renderApp('/applications?pipeline=all');

    expect(await screen.findByText('Dima Sabbagh')).toBeVisible();
    const table = within(screen.getByRole('table', { name: 'Applications' }));
    expect(table.getAllByRole('checkbox')).toHaveLength(4);
  });

  it('offers no sweep, because a statement about every Job at once is one about none', async () => {
    server.use(...signedInAs(RECRUITER), ...listsTenantApplications(EVERYONE));

    await renderApp('/applications?pipeline=all');

    expect(await screen.findByText('Dima Sabbagh')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'End many' })).toBeNull();
  });

  it('says how many rows are ticked, and gives them all back', async () => {
    server.use(...signedInAs(RECRUITER), ...listsTenantApplications(EVERYONE));

    const { user } = await renderApp('/applications?pipeline=all');
    expect(await screen.findByText('Dima Sabbagh')).toBeVisible();

    await user.click(tickOf('Dima Sabbagh'));
    expect(screen.getByRole('status')).toHaveTextContent('1 Application ticked');

    await user.click(tickOf('Farah Doumani'));
    expect(screen.getByRole('status')).toHaveTextContent('2 Applications ticked');

    await user.click(screen.getByRole('button', { name: 'Clear ticks' }));
    expect(screen.queryByRole('button', { name: /^End \d/ })).toBeNull();
  });

  it('ends the rows it ticked, one move each, and says when they hear', async () => {
    const asked: string[] = [];
    const listed = [DIMA, FARAH, ELIAS, GHADA, HANI];
    server.use(...signedInAs(RECRUITER), ...movesTickedApplications(listed, asked));

    const { user } = await renderApp('/applications?pipeline=all');
    expect(await screen.findByText('Dima Sabbagh')).toBeVisible();
    await user.click(tickOf('Dima Sabbagh'));
    await user.click(tickOf('Farah Doumani'));
    await user.click(screen.getByRole('button', { name: 'End 2 Applications' }));
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: 'End 2 Applications',
      }),
    );

    expect(await screen.findByText(/2 Applications ended/)).toBeVisible();
    expect(asked).toEqual([DIMA.id, FARAH.id]);
    await waitFor(() => expect(pipelineChip('Rejected')).toHaveAccessibleName('Rejected 3'));
    expect(screen.queryByRole('button', { name: /^End \d/ })).toBeNull();
  });

  it('says which of the ticked rows had already moved under the reader', async () => {
    const listed = [DIMA, FARAH, ELIAS, GHADA, HANI];
    server.use(...signedInAs(RECRUITER), ...movesTickedApplications(listed));

    const { user } = await renderApp('/applications?pipeline=all');
    expect(await screen.findByText('Dima Sabbagh')).toBeVisible();
    await user.click(tickOf('Dima Sabbagh'));
    await user.click(tickOf('Farah Doumani'));
    listed[1] = { ...FARAH, status: 'hired' };
    await user.click(screen.getByRole('button', { name: 'End 2 Applications' }));
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: 'End 2 Applications',
      }),
    );

    expect(
      await screen.findByText('1 of 2 Applications ended — the other had already moved.'),
    ).toBeVisible();
  });

  it('says so and reads the list again when one of the moves fails outright', async () => {
    const listed = [DIMA, FARAH, ELIAS, GHADA, HANI];
    server.use(
      ...signedInAs(RECRUITER),
      ...movesTickedApplications(listed, undefined, { id: FARAH.id, problem: SERVER_FAULT }),
    );

    const { user } = await renderApp('/applications?pipeline=all');
    expect(await screen.findByText('Dima Sabbagh')).toBeVisible();
    await user.click(tickOf('Dima Sabbagh'));
    await user.click(tickOf('Farah Doumani'));
    await user.click(screen.getByRole('button', { name: 'End 2 Applications' }));
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: 'End 2 Applications',
      }),
    );

    expect(await screen.findByText('Not all moved')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(pipelineChip('Rejected')).toHaveAccessibleName('Rejected 2'));
    expect(screen.getByText('Farah Doumani')).toBeVisible();
  });

  it('offers the ladder moves the ticked rows admit, beside the ending', async () => {
    server.use(...signedInAs(RECRUITER), ...listsTenantApplications(EVERYONE));

    const { user } = await renderApp('/applications?pipeline=all');
    expect(await screen.findByText('Dima Sabbagh')).toBeVisible();
    await user.click(tickOf('Dima Sabbagh'));
    await user.click(screen.getByRole('button', { name: /^Move ticked to/ }));

    const menu = within(await screen.findByRole('menu'));
    expect(menu.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
      'Reviewing',
      'Shortlisted',
      'Interview',
      'Offer',
    ]);
  });

  it('drops the move to Reviewing once a row already in Reviewing is ticked', async () => {
    server.use(...signedInAs(RECRUITER), ...listsTenantApplications(EVERYONE));

    const { user } = await renderApp('/applications?pipeline=all');
    expect(await screen.findByText('Dima Sabbagh')).toBeVisible();
    await user.click(tickOf('Dima Sabbagh'));
    await user.click(tickOf('Elias Murad'));
    await user.click(screen.getByRole('button', { name: /^Move ticked to/ }));

    const menu = within(await screen.findByRole('menu'));
    expect(menu.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
      'Shortlisted',
      'Interview',
      'Offer',
    ]);
  });

  it('shortlists the rows it ticked, one move each, and claims nobody was told', async () => {
    const asked: string[] = [];
    const listed = [DIMA, FARAH, ELIAS, GHADA, HANI];
    server.use(...signedInAs(RECRUITER), ...movesTickedApplications(listed, asked));

    const { user } = await renderApp('/applications?pipeline=all');
    expect(await screen.findByText('Dima Sabbagh')).toBeVisible();
    await user.click(tickOf('Dima Sabbagh'));
    await user.click(tickOf('Farah Doumani'));
    await user.click(screen.getByRole('button', { name: /^Move ticked to/ }));
    await user.click(
      within(await screen.findByRole('menu')).getByRole('menuitem', { name: 'Shortlisted' }),
    );
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: 'Move 2 Applications to Shortlisted',
      }),
    );

    expect(await screen.findByText('2 Applications are in Shortlisted.')).toBeVisible();
    expect(asked).toEqual([DIMA.id, FARAH.id]);
    await waitFor(() => expect(pipelineChip('Shortlisted')).toHaveAccessibleName('Shortlisted 2'));
  });

  it('takes a sweep back by reading the rejections and moving them to Reviewing', async () => {
    const asked: string[] = [];
    const listed = [DIMA, FARAH, ELIAS, GHADA, HANI];
    server.use(...signedInAs(RECRUITER), ...movesTickedApplications(listed, asked));

    const { user } = await renderApp('/applications?pipeline=rejected');
    expect(await screen.findByText('Ghada Kanaan')).toBeVisible();
    await user.click(tickOf('Ghada Kanaan'));
    await user.click(screen.getByRole('button', { name: 'Move 1 Application back to Reviewing' }));
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: 'Move 1 Application back to Reviewing',
      }),
    );

    expect(await screen.findByText(/^1 Application is back in Reviewing\./)).toBeVisible();
    expect(asked).toEqual([GHADA.id]);
    await waitFor(() => expect(pipelineChip('Reviewing')).toHaveAccessibleName('Reviewing 2'));
  });

  it('drops the ticks when the order the list is read in changes', async () => {
    server.use(...signedInAs(RECRUITER), ...listsTenantApplications(EVERYONE));

    const { user } = await renderApp('/applications?pipeline=all');
    expect(await screen.findByText('Dima Sabbagh')).toBeVisible();
    await user.click(tickOf('Dima Sabbagh'));
    expect(screen.getByRole('status')).toHaveTextContent('1 Application ticked');

    await user.click(receivedHeader());

    await waitFor(() => expect(screen.queryByRole('button', { name: /^End \d/ })).toBeNull());
  });

  it('drops the ticks when the list the reader is looking at changes', async () => {
    server.use(...signedInAs(RECRUITER), ...listsTenantApplications(EVERYONE));

    const { user } = await renderApp('/applications?pipeline=all');
    expect(await screen.findByText('Dima Sabbagh')).toBeVisible();
    await user.click(tickOf('Dima Sabbagh'));
    expect(screen.getByRole('status')).toHaveTextContent('1 Application ticked');

    await user.click(pipelineChip('New'));

    await waitFor(() => expect(screen.queryByRole('button', { name: /^End \d/ })).toBeNull());
  });
});
