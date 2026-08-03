import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AMAL, AMAL_REVIEW, BASSEL, CARLA } from '@/features/applications/testing/fixtures';
import { getsApplication } from '@/features/applications/testing/handlers';
import { signedInAs } from '@/features/auth/testing/handlers';
import { DIMA, ELIAS, FARAH, MEAL_OFFICER, TODAY } from '@/features/dashboard/testing/fixtures';
import {
  failsOneJobsApplications,
  holdsApplicationsPerJob,
  listsApplicationsPerJob,
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

const APPLICATIONS = {
  [FIELD_COORDINATOR.id]: { items: [AMAL, BASSEL, CARLA] },
  [MEAL_OFFICER.id]: { items: [DIMA, FARAH, ELIAS] },
};

function panel(name: string) {
  return within(screen.getByRole('region', { name }));
}

describe('the Dashboard', () => {
  // Only the clock is frozen: "this week" has to mean one fixed week for the counts to be
  // assertable, while MSW and user events keep their real timers.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(TODAY);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('names the Tenant it is counting for', async () => {
    server.use(...signedInAs(RECRUITER), ...listsJobs([]), ...listsApplicationsPerJob({}));

    await renderApp('/dashboard');

    expect(await screen.findByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();
    expect(screen.getByText('Aman Relief')).toBeVisible();
  });

  it('counts what is open, what has come in, and what waits to be reviewed', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...listsJobs(TENANT_JOBS),
      ...listsApplicationsPerJob(APPLICATIONS),
    );

    await renderApp('/dashboard');
    const stats = within(await screen.findByRole('region', { name: 'Hiring at a glance' }));

    expect(stats.getByText('Open jobs')).toBeVisible();
    expect(stats.getByText('2')).toBeVisible();
    expect(stats.getByText('1 Job in draft')).toBeVisible();

    expect(stats.getByText('Applications this week')).toBeVisible();
    expect(stats.getByText('6')).toBeVisible();
    expect(stats.getByText('1 arrived in the last day')).toBeVisible();

    expect(stats.getByText('Awaiting review')).toBeVisible();
    expect(stats.getByText('4')).toBeVisible();
    expect(stats.getByText('Needs attention')).toBeVisible();

    expect(stats.getByText('Qualified by screening')).toBeVisible();
    expect(stats.getByText('3')).toBeVisible();
    expect(stats.getByText('75% pass rate')).toBeVisible();
  });

  it('says what the counts were read from rather than claiming a tenant-wide total', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...listsJobs(TENANT_JOBS),
      ...listsApplicationsPerJob(APPLICATIONS),
    );

    await renderApp('/dashboard');
    const stats = within(await screen.findByRole('region', { name: 'Hiring at a glance' }));

    expect(
      stats.getByText(
        'Counted from the 6 newest Applications on all 2 published Jobs. Tenant-wide totals arrive when the analytics endpoints ship.',
      ),
    ).toBeVisible();
  });

  it('marks a count as a floor when a page it read had more behind it', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...listsJobs([FIELD_COORDINATOR, MEAL_OFFICER]),
      ...listsApplicationsPerJob({
        [FIELD_COORDINATOR.id]: { items: [AMAL, BASSEL, CARLA], next_cursor: 'older' },
        [MEAL_OFFICER.id]: { items: [DIMA] },
      }),
    );

    await renderApp('/dashboard');
    const stats = within(await screen.findByRole('region', { name: 'Hiring at a glance' }));

    expect(stats.getByText('4+')).toBeVisible();
    expect(stats.getAllByText('2+')).toHaveLength(2);
    expect(stats.getByText('2')).toBeVisible();
  });

  it('lists the newest Applications of every published Job, and which Job each answers', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...listsJobs(TENANT_JOBS),
      ...listsApplicationsPerJob(APPLICATIONS),
    );

    await renderApp('/dashboard');
    const recent = panel('Recent applications');

    const rows = await within(
      recent.getByRole('table', { name: 'Recent applications' }),
    ).findAllByRole('row');
    expect(rows.slice(1).map((row) => row.textContent)).toEqual([
      expect.stringContaining('Dima Sabbagh'),
      expect.stringContaining('Farah Doumani'),
      expect.stringContaining('Elias Murad'),
      expect.stringContaining('Amal Haddad'),
      expect.stringContaining('Bassel Nasser'),
      expect.stringContaining('Carla Rizk'),
    ]);
    expect(rows[1]?.textContent).toContain('MEAL Officer');
    expect(rows[4]?.textContent).toContain('Field Coordinator');
    expect(recent.getAllByText('Qualified')).toHaveLength(3);
    expect(recent.getByText('Review required')).toBeVisible();
  });

  it('opens an Application from its row', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...listsJobs([FIELD_COORDINATOR]),
      ...listsApplicationsPerJob({ [FIELD_COORDINATOR.id]: { items: [AMAL] } }),
      ...getsApplication(AMAL_REVIEW),
    );

    const { router, user } = await renderApp('/dashboard');
    await user.click(await screen.findByRole('button', { name: "Open Amal Haddad's Application" }));

    await waitFor(() => expect(router.state.location.pathname).toBe(`/applications/${AMAL.id}`));
    expect(await screen.findByRole('heading', { level: 1, name: 'Amal Haddad' })).toBeVisible();
  });

  it('opens a Job from the overview', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...listsJobs([FIELD_COORDINATOR]),
      ...listsApplicationsPerJob({ [FIELD_COORDINATOR.id]: { items: [] } }),
      ...getsJob(FIELD_COORDINATOR_VIEW),
    );

    const { router, user } = await renderApp('/dashboard');
    const jobs = panel('Your jobs');
    await user.click(await jobs.findByRole('button', { name: 'Open Field Coordinator' }));

    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`/jobs/${FIELD_COORDINATOR.id}`),
    );
  });

  it('lists the newest Jobs whatever state each is in', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...listsJobs(TENANT_JOBS),
      ...listsApplicationsPerJob(APPLICATIONS),
    );

    await renderApp('/dashboard');
    const jobs = panel('Your jobs');

    expect(await jobs.findByText('Field Coordinator')).toBeVisible();
    expect(jobs.getByText('MEAL Officer')).toBeVisible();
    expect(jobs.getByText('Programme Officer')).toBeVisible();
    expect(jobs.getAllByText('Published')).toHaveLength(2);
    expect(jobs.getByText('Draft')).toBeVisible();
    expect(jobs.getByText('Aleppo · On-site · Full time')).toBeVisible();
  });

  it('keeps the trend-chart slots as placeholders that name what is coming', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...listsJobs(TENANT_JOBS),
      ...listsApplicationsPerJob(APPLICATIONS),
    );

    await renderApp('/dashboard');

    const reach = panel('Where applicants find you');
    expect(reach.getByText('Chart pending')).toBeVisible();
    expect(
      reach.getByText(/Views by channel over time land here once the tenant analytics endpoint/),
    ).toBeVisible();

    const pipeline = panel('Pipeline at a glance');
    expect(pipeline.getByText('Chart pending')).toBeVisible();
    expect(
      pipeline.getByText(/Counts by Pipeline stage land here with the same analytics endpoints/),
    ).toBeVisible();
  });

  it('gives an empty workspace one thing to do', async () => {
    server.use(...signedInAs(RECRUITER), ...listsJobs([]), ...listsApplicationsPerJob({}));

    await renderApp('/dashboard');

    expect(
      await screen.findByText(
        'Nothing to count yet — publish a Job and these fill in as candidates apply.',
      ),
    ).toBeVisible();
    const jobs = panel('Your jobs');
    expect(
      jobs.getByText('No Jobs yet — write the first role your Tenant is hiring for.'),
    ).toBeVisible();
    expect(jobs.getByRole('button', { name: 'Create your first job' })).toBeVisible();
  });

  it('says so when the Tenant has Jobs but nobody has applied', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...listsJobs([FIELD_COORDINATOR]),
      ...listsApplicationsPerJob({ [FIELD_COORDINATOR.id]: { items: [] } }),
    );

    await renderApp('/dashboard');
    const recent = panel('Recent applications');

    expect(
      await recent.findByText(
        'No one has applied yet — publish a Job and share a tracked link to bring candidates to it.',
      ),
    ).toBeVisible();
    expect(recent.getByRole('link', { name: 'Go to Jobs' })).toBeVisible();
  });

  it('fails the Applications panel on its own and retries it inline', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...listsJobs([FIELD_COORDINATOR, MEAL_OFFICER]),
      ...failsOneJobsApplications(FIELD_COORDINATOR.id, APPLICATIONS, SERVER_FAULT),
    );

    const { user } = await renderApp('/dashboard');
    const recent = panel('Recent applications');

    expect(await recent.findByRole('alert')).toHaveTextContent('Something went wrong on our side.');
    // The Jobs read answered, so its panel is untouched by the refusal beside it.
    const jobs = panel('Your jobs');
    expect(jobs.getByText('Field Coordinator')).toBeVisible();
    expect(jobs.getByText('MEAL Officer')).toBeVisible();
    expect(recent.getByText('Dima Sabbagh')).toBeVisible();

    server.use(...listsApplicationsPerJob(APPLICATIONS));
    await user.click(recent.getByRole('button', { name: 'Retry' }));

    expect(await recent.findByText('Amal Haddad')).toBeVisible();
    expect(recent.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('retries the Jobs read inline, without failing the page around it', async () => {
    server.use(...signedInAs(RECRUITER), ...failsToListJobs(SERVER_FAULT));

    const { user } = await renderApp('/dashboard');

    expect(await screen.findByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();
    const jobs = panel('Your jobs');
    expect(await jobs.findByRole('alert')).toHaveTextContent('Something went wrong on our side.');

    server.use(
      ...listsJobs([FIELD_COORDINATOR]),
      ...listsApplicationsPerJob({ [FIELD_COORDINATOR.id]: { items: [AMAL] } }),
    );
    await user.click(jobs.getByRole('button', { name: 'Retry' }));

    expect(await jobs.findByText('Field Coordinator')).toBeVisible();
    expect(await panel('Recent applications').findByText('Amal Haddad')).toBeVisible();
  });

  it('holds the counts on skeletons while the Applications are still on the wire', async () => {
    const held = holdsApplicationsPerJob(APPLICATIONS);
    server.use(...signedInAs(RECRUITER), ...listsJobs(TENANT_JOBS), ...held.handlers);

    await renderApp('/dashboard');

    expect(await screen.findByRole('status', { name: 'Loading the counts' })).toBeVisible();
    // The Jobs panel does not wait on the Applications beside it.
    expect(panel('Your jobs').getByText('Field Coordinator')).toBeVisible();

    held.arrive();

    expect(await screen.findByText('75% pass rate')).toBeVisible();
    expect(screen.queryByRole('status', { name: 'Loading the counts' })).not.toBeInTheDocument();
  });

  it('writes a new Job without leaving the Dashboard', async () => {
    server.use(...signedInAs(RECRUITER), ...listsJobs([]), ...listsApplicationsPerJob({}));

    const { user } = await renderApp('/dashboard');
    await user.click(screen.getByRole('button', { name: 'Create job' }));

    expect(await screen.findByRole('heading', { name: 'Create a Job' })).toBeVisible();
    expect(screen.getByLabelText('Title')).toBeVisible();
  });
});
