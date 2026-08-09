import { screen, waitFor, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ACTIVE_PIPELINE_STATUSES, PIPELINE_STATUSES } from '@/features/applications/application';
import {
  AMAL_REVIEW,
  DIMA,
  ELIAS,
  FARAH,
  GHADA,
  HANI,
} from '@/features/applications/testing/fixtures';
import {
  failsToListTenantApplications,
  getsApplication,
  listsTenantApplications,
  pagesTenantApplications,
  type TenantAskedFor,
} from '@/features/applications/testing/handlers';
import { signedInAs } from '@/features/auth/testing/handlers';
import { A_BUSY_WEEK } from '@/features/dashboard/testing/fixtures';
import { servesStats } from '@/features/dashboard/testing/handlers';
import { FIELD_COORDINATOR_VIEW } from '@/features/jobs/testing/fixtures';
import { getsJob, listsJobs } from '@/features/jobs/testing/handlers';
import { absoluteDateTime, relativeTime } from '@/lib/dates';
import { RECRUITER, SERVER_FAULT, TODAY } from '@/testing/fixtures';
import { renderApp } from '@/testing/render-app';
import { server } from '@/testing/server';

const ACTIVE = [...ACTIVE_PIPELINE_STATUSES];
const EVERY_STATUS = [...PIPELINE_STATUSES];

const EVERYONE = [DIMA, FARAH, ELIAS, GHADA, HANI];

function inUrl(chosen: readonly string[]) {
  return encodeURIComponent(JSON.stringify(chosen));
}

function rowOf(candidate: string) {
  return within(screen.getByRole('row', { name: new RegExp(candidate) }));
}

function statusTrigger() {
  return screen.getByRole('button', { name: /^Pipeline: / });
}

async function openStatuses(user: UserEvent) {
  await user.click(statusTrigger());
  await screen.findByRole('menu');
}

function checkItem(label: string) {
  return screen.getByRole('menuitemcheckbox', { name: new RegExp(`^${label}`) });
}

function rangeTrigger() {
  return screen.getByRole('combobox', { name: 'Received' });
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

    await renderApp('/applications');

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
    await user.click(
      await screen.findByRole('button', { name: "Open Dima Sabbagh's Application" }),
    );

    await waitFor(() => expect(router.state.location.pathname).toBe(`/applications/${DIMA.id}`));
  });

  it('asks for the six active statuses and all time until the reader says otherwise', async () => {
    const asked: TenantAskedFor[] = [];
    server.use(...signedInAs(RECRUITER), ...listsTenantApplications(EVERYONE, asked));

    await renderApp('/applications');

    expect(await screen.findByText('Dima Sabbagh')).toBeVisible();
    expect(screen.queryByText('Ghada Kanaan')).toBeNull();
    expect(asked.every((one) => one.status.join() === ACTIVE.join())).toBe(true);
    expect(asked.every((one) => one.received_within === null)).toBe(true);
    expect(statusTrigger()).toHaveAccessibleName('Pipeline: 6 statuses');
    expect(rangeTrigger()).toHaveTextContent('All time');
  });

  it('counts every status, including the ones the filter is hiding', async () => {
    server.use(...signedInAs(RECRUITER), ...listsTenantApplications(EVERYONE));

    const { user } = await renderApp('/applications');
    expect(await screen.findByText('Dima Sabbagh')).toBeVisible();

    await openStatuses(user);

    expect(checkItem('New')).toHaveAccessibleName('New, 2');
    expect(checkItem('Reviewing')).toHaveAccessibleName('Reviewing, 1');
    expect(checkItem('Rejected')).toHaveAccessibleName('Rejected, 1');
    expect(checkItem('Withdrawn')).toHaveAccessibleName('Withdrawn, 0');
    expect(checkItem('Rejected')).toHaveAttribute('aria-checked', 'false');
  });

  it('brings a hidden status back into the list and into the address bar', async () => {
    const asked: TenantAskedFor[] = [];
    server.use(...signedInAs(RECRUITER), ...listsTenantApplications(EVERYONE, asked));

    const { router, user } = await renderApp('/applications');
    expect(await screen.findByText('Dima Sabbagh')).toBeVisible();

    await openStatuses(user);
    await user.click(checkItem('Rejected'));

    await waitFor(() =>
      expect(router.state.location.search).toEqual({ pipeline: [...ACTIVE, 'rejected'] }),
    );
    await waitFor(() => expect(asked.at(-1)?.status).toEqual([...ACTIVE, 'rejected']));
    expect(await screen.findByText('Ghada Kanaan')).toBeVisible();
  });

  it('narrows the list to a rolling window and writes it into the address bar', async () => {
    const asked: TenantAskedFor[] = [];
    server.use(...signedInAs(RECRUITER), ...listsTenantApplications(EVERYONE, asked));

    const { router, user } = await renderApp('/applications');
    expect(await screen.findByText('Hani Barakat')).toBeVisible();

    await user.click(rangeTrigger());
    await user.click(await screen.findByRole('option', { name: 'Last 30 days' }));

    await waitFor(() => expect(router.state.location.search).toEqual({ received: '30d' }));
    await waitFor(() => expect(asked.at(-1)?.received_within).toBe('30d'));
    expect(screen.queryByText('Hani Barakat')).toBeNull();
    expect(screen.getByText('Dima Sabbagh')).toBeVisible();
  });

  it('leaves the window out of the address bar when it is back to all time', async () => {
    server.use(...signedInAs(RECRUITER), ...listsTenantApplications(EVERYONE));

    const { router, user } = await renderApp(`/applications?received=24h`);
    expect(await screen.findByText('Dima Sabbagh')).toBeVisible();

    await user.click(rangeTrigger());
    await user.click(await screen.findByRole('option', { name: 'All time' }));

    await waitFor(() => expect(router.state.location.search).toEqual({}));
    expect(await screen.findByText('Hani Barakat')).toBeVisible();
  });

  it('counts the statuses over the window the reader is looking at', async () => {
    server.use(...signedInAs(RECRUITER), ...listsTenantApplications(EVERYONE));

    const { user } = await renderApp(`/applications?received=24h`);
    expect(await screen.findByText('Dima Sabbagh')).toBeVisible();

    await openStatuses(user);

    expect(checkItem('New')).toHaveAccessibleName('New, 1');
    expect(checkItem('Reviewing')).toHaveAccessibleName('Reviewing, 0');
    expect(checkItem('Hired')).toHaveAccessibleName('Hired, 0');
  });

  it('reproduces the list a shared link was copied from', async () => {
    const asked: TenantAskedFor[] = [];
    server.use(...signedInAs(RECRUITER), ...listsTenantApplications(EVERYONE, asked));

    await renderApp(`/applications?pipeline=${inUrl(['rejected'])}&received=7d`);

    expect(await screen.findByText('Ghada Kanaan')).toBeVisible();
    expect(screen.queryByText('Dima Sabbagh')).toBeNull();
    expect(statusTrigger()).toHaveAccessibleName('Pipeline: Rejected');
    expect(rangeTrigger()).toHaveTextContent('Last 7 days');
    expect(asked.every((one) => one.status.join() === 'rejected')).toBe(true);
    expect(asked.every((one) => one.received_within === '7d')).toBe(true);
  });

  it('drops filters the platform cannot honour rather than failing the page', async () => {
    const asked: TenantAskedFor[] = [];
    server.use(...signedInAs(RECRUITER), ...listsTenantApplications(EVERYONE, asked));

    await renderApp('/applications?pipeline=on-a-yacht&received=since-tuesday');

    expect(await screen.findByText('Dima Sabbagh')).toBeVisible();
    expect(asked.every((one) => one.status.join() === ACTIVE.join())).toBe(true);
    expect(asked.every((one) => one.received_within === null)).toBe(true);
  });

  it('says a filtered view is empty because of the filters, and offers to drop them', async () => {
    server.use(...signedInAs(RECRUITER), ...listsTenantApplications(EVERYONE));

    const { router, user } = await renderApp(
      `/applications?pipeline=${inUrl(['hired'])}&received=24h`,
    );

    expect(await screen.findByText('No Application matches both filters.')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Clear filters' }));

    await waitFor(() => expect(router.state.location.search).toEqual({ pipeline: EVERY_STATUS }));
    expect(await screen.findByText('Hani Barakat')).toBeVisible();
  });

  it('points a Tenant nobody has applied to at its Jobs', async () => {
    server.use(...signedInAs(RECRUITER), ...listsTenantApplications([]));

    const { user } = await renderApp('/applications');

    expect(await screen.findByText(/No Applications yet/)).toBeVisible();

    await user.click(screen.getByRole('link', { name: 'Go to your jobs' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Jobs' })).toBeVisible();
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
