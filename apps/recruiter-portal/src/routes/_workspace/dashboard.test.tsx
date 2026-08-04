import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AMAL_REVIEW } from '@/features/applications/testing/fixtures';
import { getsApplication } from '@/features/applications/testing/handlers';
import { signedInAs } from '@/features/auth/testing/handlers';
import {
  A_BUSY_WEEK,
  DIMA,
  ELIAS,
  FARAH,
  MEAL_OFFICER,
  NOTHING_YET,
  statsWith,
  TODAY,
} from '@/features/dashboard/testing/fixtures';
import {
  failsToListTenantApplications,
  failsToServeStats,
  holdsStats,
  listsTenantApplications,
  servesStats,
} from '@/features/dashboard/testing/handlers';
import {
  FIELD_COORDINATOR,
  FIELD_COORDINATOR_VIEW,
  PROGRAMME_OFFICER,
} from '@/features/jobs/testing/fixtures';
import { failsToListJobs, getsJob, listsJobs } from '@/features/jobs/testing/handlers';
import { RECRUITER, SERVER_FAULT } from '@/testing/fixtures';
import { renderApp } from '@/testing/render-app';
import { server } from '@/testing/server';

const TENANT_JOBS = [FIELD_COORDINATOR, MEAL_OFFICER, PROGRAMME_OFFICER];
const RECENT = [DIMA, FARAH, ELIAS];

function panel(name: string) {
  return within(screen.getByRole('region', { name }));
}

/** Everything answering, which is the starting point for most of these. */
function aWorkingDashboard() {
  return [
    ...signedInAs(RECRUITER),
    ...servesStats(A_BUSY_WEEK),
    ...listsTenantApplications(RECENT),
    ...listsJobs(TENANT_JOBS),
  ];
}

describe('the Dashboard', () => {
  // Only the clock: the rows render relative times, and MSW and user events keep real timers.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(TODAY);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('names the Tenant it is counting for', async () => {
    server.use(...aWorkingDashboard());

    await renderApp('/dashboard');

    expect(await screen.findByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();
    expect(screen.getByText('Aman Relief')).toBeVisible();
  });

  it('shows the counts the API reports, with no arithmetic of its own', async () => {
    server.use(...aWorkingDashboard());

    await renderApp('/dashboard');
    const stats = within(await screen.findByRole('region', { name: 'Hiring at a glance' }));

    expect(stats.getByText('Open jobs')).toBeVisible();
    expect(stats.getByText('12')).toBeVisible();

    expect(stats.getByText('Applications this week')).toBeVisible();
    expect(stats.getByText('47')).toBeVisible();

    expect(stats.getByText('Awaiting review')).toBeVisible();
    expect(stats.getByText('23')).toBeVisible();
    expect(stats.getByText('Needs attention')).toBeVisible();

    expect(stats.getByText('Qualified by screening')).toBeVisible();
    expect(stats.getByText('61')).toBeVisible();
    expect(stats.getByText('78% pass rate')).toBeVisible();
  });

  it('compares this week with the one before it', async () => {
    server.use(...aWorkingDashboard());

    await renderApp('/dashboard');
    const stats = within(await screen.findByRole('region', { name: 'Hiring at a glance' }));

    expect(stats.getByText('+2 since last week')).toBeVisible();
    expect(stats.getByText('+8 vs last week')).toBeVisible();
  });

  it('says a quieter week is quieter rather than dressing it up', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...servesStats(
        statsWith({
          applications: { ...A_BUSY_WEEK.applications, last_7d: 30, previous_7d: 39 },
        }),
      ),
      ...listsTenantApplications(RECENT),
      ...listsJobs(TENANT_JOBS),
    );

    await renderApp('/dashboard');

    expect(await screen.findByText('-9 vs last week')).toBeVisible();
  });

  it('shows no pass rate at all when Screening has decided nothing', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...servesStats(statsWith({ applications: { ...A_BUSY_WEEK.applications, pass_rate: null } })),
      ...listsTenantApplications(RECENT),
      ...listsJobs(TENANT_JOBS),
    );

    await renderApp('/dashboard');

    expect(await screen.findByText('No verdict decided yet')).toBeVisible();
    expect(screen.queryByText(/pass rate/)).not.toBeInTheDocument();
  });

  it('never claims a floor now that the counts are whole', async () => {
    server.use(...aWorkingDashboard());

    await renderApp('/dashboard');
    await screen.findByText('78% pass rate');

    expect(screen.queryByText(/Counted from/)).not.toBeInTheDocument();
    expect(screen.queryByText(/\d\+/)).not.toBeInTheDocument();
  });

  it('lists the newest Applications of the whole Tenant, and which Job each answers', async () => {
    server.use(...aWorkingDashboard());

    await renderApp('/dashboard');
    const recent = panel('Recent applications');

    expect(await recent.findByText('Dima Sabbagh')).toBeVisible();
    expect(recent.getByText('Farah Doumani')).toBeVisible();
    expect(recent.getByText('Field Coordinator')).toBeVisible();
    expect(recent.getAllByText('MEAL Officer').length).toBeGreaterThan(0);
  });

  it('opens an Application from its row', async () => {
    server.use(...aWorkingDashboard(), ...getsApplication(AMAL_REVIEW));

    const { router, user } = await renderApp('/dashboard');
    const recent = panel('Recent applications');
    await user.click(
      await recent.findByRole('button', { name: "Open Dima Sabbagh's Application" }),
    );

    await waitFor(() => expect(router.state.location.pathname).toBe(`/applications/${DIMA.id}`));
  });

  it('opens a Job from the overview', async () => {
    server.use(...aWorkingDashboard(), ...getsJob(FIELD_COORDINATOR_VIEW));

    const { user } = await renderApp('/dashboard');
    const jobs = panel('Your jobs');
    await user.click(await jobs.findByRole('button', { name: 'Open Field Coordinator' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Field Coordinator' }),
    ).toBeVisible();
  });

  it('says how many Applications each Job has brought in', async () => {
    server.use(...aWorkingDashboard());

    await renderApp('/dashboard');
    const jobs = panel('Your jobs');

    expect(await jobs.findByText('18 applications')).toBeVisible();
    expect(jobs.getByText('9 applications')).toBeVisible();
    // The draft has none, so its row says when it was last touched instead.
    expect(jobs.getByText(/^Updated/)).toBeVisible();
  });

  it('draws where applicants come from, ranked', async () => {
    server.use(...aWorkingDashboard());

    await renderApp('/dashboard');
    const sources = panel('Where applicants find you');

    const chart = await sources.findByRole('img');
    expect(chart).toHaveAccessibleName(/LinkedIn post: 342 views/);
    expect(chart).toHaveAccessibleName(/WhatsApp groups: 281 views/);
    expect(chart).toHaveAccessibleName(/Direct: 190 views/);
  });

  it('says how many channels it is showing you out of how many there are', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...servesStats(statsWith({ sources_total: 11 })),
      ...listsTenantApplications(RECENT),
      ...listsJobs(TENANT_JOBS),
    );

    await renderApp('/dashboard');

    expect(
      await screen.findByText('Your busiest 4 of 11 channels, by the Job views each brought.'),
    ).toBeVisible();
  });

  it('claims no remainder when the card is showing every channel', async () => {
    server.use(...aWorkingDashboard());

    await renderApp('/dashboard');
    const sources = panel('Where applicants find you');

    expect(await sources.findByText(/added up across your Jobs/)).toBeVisible();
    expect(screen.queryByText(/busiest/)).not.toBeInTheDocument();
  });

  it('keeps the link out about where it goes, not about the chart beside it', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...servesStats(statsWith({ sources_total: 11 })),
      ...listsTenantApplications(RECENT),
      ...listsJobs(TENANT_JOBS),
    );

    await renderApp('/dashboard');
    const sources = panel('Where applicants find you');

    // A count of channels on a link to a page of links would describe neither.
    expect(await sources.findByRole('link', { name: 'All links' })).toBeVisible();
  });

  it('sends anyone who wants the rest to the Tracked links page', async () => {
    server.use(...aWorkingDashboard());

    const { user } = await renderApp('/dashboard');
    const sources = panel('Where applicants find you');
    await user.click(await sources.findByRole('link', { name: 'All links' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Tracked links' })).toBeVisible();
  });

  it('holds no slot for a chart that is not coming', async () => {
    server.use(...aWorkingDashboard());

    await renderApp('/dashboard');
    await screen.findByText('78% pass rate');

    expect(screen.queryByText('Chart pending')).not.toBeInTheDocument();
    expect(screen.queryByText('Pipeline at a glance')).not.toBeInTheDocument();
  });

  it('gives an empty workspace one thing to do', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...servesStats(NOTHING_YET),
      ...listsTenantApplications([]),
      ...listsJobs([]),
    );

    await renderApp('/dashboard');

    expect(
      await panel('Your jobs').findByRole('button', { name: 'Create your first job' }),
    ).toBeVisible();
    expect(panel('Where applicants find you').getByText(/No views yet/)).toBeVisible();
  });

  it('says so when the Tenant has Jobs but nobody has applied', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...servesStats(NOTHING_YET),
      ...listsTenantApplications([]),
      ...listsJobs(TENANT_JOBS),
    );

    await renderApp('/dashboard');

    expect(await panel('Recent applications').findByText(/No one has applied yet/)).toBeVisible();
    expect(panel('Your jobs').getByText('Field Coordinator')).toBeVisible();
  });

  it('fails the Applications panel on its own and retries it inline', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...servesStats(A_BUSY_WEEK),
      ...listsJobs(TENANT_JOBS),
      ...failsToListTenantApplications(SERVER_FAULT),
    );

    const { user } = await renderApp('/dashboard');
    const recent = panel('Recent applications');
    expect(await recent.findByRole('alert')).toHaveTextContent('Something went wrong on our side.');
    // The counts beside it are a different read, and they answered.
    expect(screen.getByText('78% pass rate')).toBeVisible();

    server.use(...listsTenantApplications(RECENT));
    await user.click(recent.getByRole('button', { name: 'Retry' }));

    expect(await recent.findByText('Dima Sabbagh')).toBeVisible();
  });

  it('blanks the counts and the chart together, since they are one read', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...failsToServeStats(SERVER_FAULT),
      ...listsTenantApplications(RECENT),
      ...listsJobs(TENANT_JOBS),
    );

    await renderApp('/dashboard');

    const stats = within(await screen.findByRole('region', { name: 'Hiring at a glance' }));
    expect(await stats.findByRole('alert')).toBeVisible();
    expect(await panel('Where applicants find you').findByRole('alert')).toBeVisible();
    // And nothing else on the page went with them.
    expect(await panel('Recent applications').findByText('Dima Sabbagh')).toBeVisible();
    expect(panel('Your jobs').getByText('Field Coordinator')).toBeVisible();
  });

  it('retries the Jobs read inline, without failing the page around it', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...servesStats(A_BUSY_WEEK),
      ...listsTenantApplications(RECENT),
      ...failsToListJobs(SERVER_FAULT),
    );

    const { user } = await renderApp('/dashboard');
    const jobs = panel('Your jobs');
    expect(await jobs.findByRole('alert')).toHaveTextContent('Something went wrong on our side.');

    server.use(...listsJobs([FIELD_COORDINATOR]));
    await user.click(jobs.getByRole('button', { name: 'Retry' }));

    expect(await jobs.findByText('Field Coordinator')).toBeVisible();
    expect(panel('Recent applications').getByText('Dima Sabbagh')).toBeVisible();
  });

  it('holds the counts on skeletons while they are still on the wire', async () => {
    const held = holdsStats(A_BUSY_WEEK);
    server.use(
      ...signedInAs(RECRUITER),
      ...listsTenantApplications(RECENT),
      ...listsJobs(TENANT_JOBS),
      ...held.handlers,
    );

    await renderApp('/dashboard');

    expect(await screen.findByRole('status', { name: 'Loading the counts' })).toBeVisible();
    // The Jobs panel does not wait on the counts beside it.
    expect(panel('Your jobs').getByText('Field Coordinator')).toBeVisible();

    held.arrive();

    expect(await screen.findByText('78% pass rate')).toBeVisible();
    expect(screen.queryByRole('status', { name: 'Loading the counts' })).not.toBeInTheDocument();
  });

  it('writes a new Job without leaving the Dashboard', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...servesStats(NOTHING_YET),
      ...listsTenantApplications([]),
      ...listsJobs([]),
    );

    const { user } = await renderApp('/dashboard');
    await user.click(screen.getByRole('button', { name: 'Create job' }));

    expect(await screen.findByRole('heading', { name: 'Create a Job' })).toBeVisible();
    expect(screen.getByLabelText('Title')).toBeVisible();
  });
});
