import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AMAL_REVIEW, DIMA, ELIAS, FARAH } from '@/features/applications/testing/fixtures';
import {
  failsToListTenantApplications,
  getsApplication,
  listsTenantApplications,
} from '@/features/applications/testing/handlers';
import { signedInAs } from '@/features/auth/testing/handlers';
import {
  A_BUSY_WEEK,
  MEAL_OFFICER,
  NOTHING_YET,
  statsWith,
} from '@/features/dashboard/testing/fixtures';
import { failsToServeStats, holdsStats, servesStats } from '@/features/dashboard/testing/handlers';
import {
  FIELD_COORDINATOR,
  FIELD_COORDINATOR_VIEW,
  PROGRAMME_OFFICER,
} from '@/features/jobs/testing/fixtures';
import { failsToListJobs, getsJob, listsJobs } from '@/features/jobs/testing/handlers';
import { RECRUITER, SERVER_FAULT, TODAY } from '@/testing/fixtures';
import { renderApp } from '@/testing/render-app';
import { server } from '@/testing/server';

const TENANT_JOBS = [FIELD_COORDINATOR, MEAL_OFFICER, PROGRAMME_OFFICER];
const RECENT = [DIMA, FARAH, ELIAS];

function panel(name: string) {
  return within(screen.getByRole('region', { name }));
}

function aWorkingDashboard() {
  return [
    ...signedInAs(RECRUITER),
    ...servesStats(A_BUSY_WEEK),
    ...listsTenantApplications(RECENT),
    ...listsJobs(TENANT_JOBS),
  ];
}

describe('the Dashboard', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(TODAY);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('greets the Recruiter and names the Tenant it is counting for', async () => {
    vi.setSystemTime(new Date(2026, 7, 9, 9));
    server.use(...aWorkingDashboard());

    await renderApp('/dashboard');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Good morning, Rana' }),
    ).toBeVisible();
    expect(await screen.findByText('Aman Relief')).toBeVisible();
    expect(screen.getByText('Sunday, 9 August 2026')).toBeVisible();
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

  it('sends Awaiting review to the Applications the number counted', async () => {
    server.use(...aWorkingDashboard());

    const { router, user } = await renderApp('/dashboard');
    await user.click(await screen.findByRole('link', { name: /Awaiting review/ }));

    expect(await screen.findByRole('tab', { name: /^New / })).toHaveAttribute('data-active');
    expect(router.state.location.pathname).toBe('/applications');
    expect(router.state.location.search).toEqual({ pipeline: ['new'] });
  });

  it('sends Applications this week to the week, terminal Applications included', async () => {
    server.use(...aWorkingDashboard());

    const { router, user } = await renderApp('/dashboard');
    await user.click(await screen.findByRole('link', { name: /Applications this week/ }));

    expect(await screen.findByRole('combobox', { name: 'Received' })).toHaveTextContent(
      'Last 7 days',
    );
    expect(router.state.location.pathname).toBe('/applications');
    expect(screen.getByRole('tab', { name: /^All / })).toHaveAttribute('data-active');
    expect(router.state.location.search).toEqual({ received: '7d' });
  });

  it('sends Open jobs to the published Jobs the number counted', async () => {
    server.use(...aWorkingDashboard());

    const { router, user } = await renderApp('/dashboard');
    await user.click(await screen.findByRole('link', { name: /Open jobs/ }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Jobs' })).toBeVisible();
    expect(screen.getByRole('tab', { name: 'Published' })).toHaveAttribute('data-active');
    expect(await screen.findByText('MEAL Officer')).toBeVisible();
    expect(router.state.location.pathname).toBe('/jobs');
    expect(router.state.location.search).toEqual({ status: 'published' });
  });

  it('sends Qualified by screening to the verdict, whatever the Pipeline did next', async () => {
    server.use(...aWorkingDashboard());

    const { router, user } = await renderApp('/dashboard');
    await user.click(await screen.findByRole('link', { name: /Qualified by screening/ }));

    expect(await screen.findByRole('button', { name: /^Screening: / })).toHaveAccessibleName(
      'Screening: Qualified',
    );
    expect(screen.getByRole('tab', { name: /^All / })).toHaveAttribute('data-active');
    expect(router.state.location.pathname).toBe('/applications');
    expect(router.state.location.search).toEqual({ screening: ['qualified'] });
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
    expect(jobs.getByText(/^Updated/)).toBeVisible();
  });

  it('lists where applicants come from, ranked by views without chart decoration', async () => {
    server.use(...aWorkingDashboard());

    await renderApp('/dashboard');
    const sources = panel('Where applicants find you');

    const rows = within(await sources.findByRole('list', { name: 'Views by source' }))
      .getAllByRole('listitem')
      .map((row) => row.textContent);

    expect(rows).toEqual([
      'LinkedIn post342',
      'WhatsApp groups281',
      'Direct190',
      'Facebook page97',
    ]);
    expect(sources.queryByText(/%/)).not.toBeInTheDocument();
    expect(sources.queryByRole('img')).not.toBeInTheDocument();
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
    expect(panel('Your jobs').getByText('Field Coordinator')).toBeVisible();

    held.arrive();

    expect(await screen.findByText('78% pass rate')).toBeVisible();
    expect(screen.queryByRole('status', { name: 'Loading the counts' })).not.toBeInTheDocument();
  });

  it('sends a recruiter writing a new Job to the full-page wizard', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...servesStats(NOTHING_YET),
      ...listsTenantApplications([]),
      ...listsJobs([]),
    );

    const { router, user } = await renderApp('/dashboard');
    await user.click(screen.getByRole('button', { name: 'Create job' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/jobs/new'));
    expect(await screen.findByRole('heading', { level: 1, name: 'Create a Job' })).toBeVisible();
    expect(screen.getByLabelText('Title')).toBeVisible();
  });
});
