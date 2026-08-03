import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AMAL, BASSEL, CARLA } from '@/features/applications/testing/fixtures';
import {
  type AskedFor,
  failsToListJobApplications,
  holdsJobApplications,
  listsJobApplications,
  pagesJobApplications,
} from '@/features/applications/testing/handlers';
import { signedInAs } from '@/features/auth/testing/handlers';
import { FIELD_COORDINATOR_VIEW } from '@/features/jobs/testing/fixtures';
import { getsJob } from '@/features/jobs/testing/handlers';
import { absoluteDateTime, relativeTime } from '@/lib/dates';
import { RECRUITER, SERVER_FAULT } from '@/testing/fixtures';
import { renderApp } from '@/testing/render-app';
import { server } from '@/testing/server';

const JOB = FIELD_COORDINATOR_VIEW;

function rowOf(candidate: string) {
  return within(screen.getByRole('row', { name: new RegExp(candidate) }));
}

function listedInOrder() {
  return screen
    .getAllByRole('button', { name: /Application$/ })
    .map((open) => open.getAttribute('aria-label'));
}

function control(name: 'Screening' | 'Pipeline') {
  return within(screen.getByRole('group', { name }));
}

function segment(name: 'Screening' | 'Pipeline', label: string) {
  return control(name).getByRole('button', { name: label });
}

describe("a Job's Applications tab", () => {
  it('lists the Applications the API sent, with both chips and a hoverable received time', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...getsJob(JOB),
      ...listsJobApplications([AMAL, BASSEL, CARLA]),
    );

    await renderApp(`/jobs/${JOB.id}`);

    expect(await screen.findByText('Amal Haddad')).toBeVisible();
    expect(listedInOrder()).toEqual([
      "Open Amal Haddad's Application",
      "Open Bassel Nasser's Application",
      "Open Carla Rizk's Application",
    ]);

    expect(rowOf('Amal Haddad').getByText('Qualified')).toBeVisible();
    expect(rowOf('Amal Haddad').getByText('New')).toBeVisible();
    expect(rowOf('Bassel Nasser').getByText('Review required')).toBeVisible();
    expect(rowOf('Bassel Nasser').getByText('Shortlisted')).toBeVisible();
    expect(rowOf('Carla Rizk').getByText('Disqualified')).toBeVisible();
    expect(rowOf('Carla Rizk').getByText('Rejected')).toBeVisible();

    expect(rowOf('Amal Haddad').getByText('Field logistics lead · Aleppo')).toBeVisible();
    expect(rowOf('Amal Haddad').getByText(relativeTime(AMAL.applied_at))).toHaveAttribute(
      'title',
      absoluteDateTime(AMAL.applied_at),
    );
  });

  it('sends both filters to the API at once and leaves them in the address bar', async () => {
    const asked: AskedFor[] = [];
    server.use(
      ...signedInAs(RECRUITER),
      ...getsJob(JOB),
      ...listsJobApplications([AMAL, BASSEL, CARLA], asked),
    );

    const { router, user } = await renderApp(`/jobs/${JOB.id}`);

    await user.click(await control('Screening').findByRole('button', { name: 'Review required' }));
    await waitFor(() =>
      expect(router.state.location.search).toEqual({ screening: 'review_required' }),
    );
    await waitFor(() =>
      expect(asked.at(-1)).toEqual({ status: null, qualification_status: 'review_required' }),
    );

    await user.click(control('Pipeline').getByRole('button', { name: 'Shortlisted' }));
    await waitFor(() =>
      expect(router.state.location.search).toEqual({
        screening: 'review_required',
        pipeline: 'shortlisted',
      }),
    );
    await waitFor(() =>
      expect(asked.at(-1)).toEqual({
        status: 'shortlisted',
        qualification_status: 'review_required',
      }),
    );

    expect(await screen.findByText('Bassel Nasser')).toBeVisible();
    expect(screen.queryByText('Amal Haddad')).toBeNull();
  });

  it('reproduces the list a shared link was copied from', async () => {
    const asked: AskedFor[] = [];
    server.use(
      ...signedInAs(RECRUITER),
      ...getsJob(JOB),
      ...listsJobApplications([AMAL, BASSEL, CARLA], asked),
    );

    await renderApp(`/jobs/${JOB.id}?pipeline=rejected&screening=disqualified`);

    expect(await screen.findByText('Carla Rizk')).toBeVisible();
    expect(screen.queryByText('Amal Haddad')).toBeNull();
    expect(segment('Screening', 'Disqualified')).toHaveAttribute('aria-pressed', 'true');
    expect(segment('Pipeline', 'Rejected')).toHaveAttribute('aria-pressed', 'true');
    expect(segment('Screening', 'All verdicts')).toHaveAttribute('aria-pressed', 'false');
    expect(asked.every((one) => one.status === 'rejected')).toBe(true);
    expect(asked.every((one) => one.qualification_status === 'disqualified')).toBe(true);
  });

  it('leaves the other filter alone when only one is set', async () => {
    const asked: AskedFor[] = [];
    server.use(
      ...signedInAs(RECRUITER),
      ...getsJob(JOB),
      ...listsJobApplications([AMAL, BASSEL, CARLA], asked),
    );

    await renderApp(`/jobs/${JOB.id}?screening=qualified`);

    expect(await screen.findByText('Amal Haddad')).toBeVisible();
    expect(asked.every((one) => one.status === null)).toBe(true);
    expect(asked.every((one) => one.qualification_status === 'qualified')).toBe(true);
    expect(segment('Pipeline', 'All statuses')).toHaveAttribute('aria-pressed', 'true');
  });

  it('drops a filter the platform cannot honour rather than failing the page', async () => {
    const asked: AskedFor[] = [];
    server.use(...signedInAs(RECRUITER), ...getsJob(JOB), ...listsJobApplications([AMAL], asked));

    await renderApp(`/jobs/${JOB.id}?pipeline=on-a-yacht`);

    expect(await screen.findByText('Amal Haddad')).toBeVisible();
    expect(asked.every((one) => one.status === null)).toBe(true);
  });

  it('takes the reader to the Application the row stands for', async () => {
    server.use(...signedInAs(RECRUITER), ...getsJob(JOB), ...listsJobApplications([AMAL]));

    const { router, user } = await renderApp(`/jobs/${JOB.id}`);

    await user.click(await screen.findByRole('button', { name: "Open Amal Haddad's Application" }));

    await waitFor(() => expect(router.state.location.pathname).toBe(`/applications/${AMAL.id}`));
  });

  it('fetches the next cursor page on demand', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...getsJob(JOB),
      ...pagesJobApplications([[AMAL], [BASSEL]]),
    );

    const { user } = await renderApp(`/jobs/${JOB.id}`);

    expect(await screen.findByText('Amal Haddad')).toBeVisible();
    expect(screen.queryByText('Bassel Nasser')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Load more' }));

    expect(await screen.findByText('Bassel Nasser')).toBeVisible();
    expect(screen.getByText('2 shown')).toBeVisible();
  });

  it('stands a skeleton in the table while the first page is on the wire', async () => {
    const held = holdsJobApplications([AMAL]);
    server.use(...signedInAs(RECRUITER), ...getsJob(JOB), ...held.handlers);

    const { user } = await renderApp(`/jobs/${JOB.id}?tab=criteria`);
    await user.click(screen.getByRole('tab', { name: 'Applications' }));

    expect(await screen.findByRole('columnheader', { name: 'Candidate' })).toBeVisible();
    expect(document.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);

    held.arrive();

    expect(await screen.findByText('Amal Haddad')).toBeVisible();
  });

  it('reports a failed list inline and reloads it on retry', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...getsJob(JOB),
      ...failsToListJobApplications(SERVER_FAULT),
    );

    const { user } = await renderApp(`/jobs/${JOB.id}`);

    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong on our side.');

    server.use(...listsJobApplications([AMAL]));
    await user.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByText('Amal Haddad')).toBeVisible();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('points an untouched Job at its tracked links rather than at nothing', async () => {
    server.use(...signedInAs(RECRUITER), ...getsJob(JOB), ...listsJobApplications([]));

    const { router, user } = await renderApp(`/jobs/${JOB.id}`);

    expect(
      await screen.findByText(
        'No one has applied yet — a tracked link is the quickest way to bring candidates to this Job.',
      ),
    ).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Go to tracked links' }));

    await waitFor(() => expect(router.state.location.search).toEqual({ tab: 'links' }));
    expect(screen.getByText('Tracked links will appear here.')).toBeVisible();
  });

  it('says a filtered view is empty because of the filters, and offers to drop them', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...getsJob(JOB),
      ...listsJobApplications([AMAL, BASSEL, CARLA]),
    );

    const { router, user } = await renderApp(`/jobs/${JOB.id}?pipeline=hired&screening=pending`);

    expect(
      await screen.findByText('No Application on this Job matches both filters.'),
    ).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Clear filters' }));

    await waitFor(() => expect(router.state.location.search).toEqual({}));
    expect(await screen.findByText('Amal Haddad')).toBeVisible();
  });

  it('counts the filters it blames an empty view on', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...getsJob(JOB),
      ...listsJobApplications([AMAL, BASSEL, CARLA]),
    );

    const { router, user } = await renderApp(`/jobs/${JOB.id}?pipeline=hired`);

    expect(
      await screen.findByText('No Application on this Job matches that filter.'),
    ).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Clear filter' }));

    await waitFor(() => expect(router.state.location.search).toEqual({}));
    expect(await screen.findByText('Amal Haddad')).toBeVisible();
  });

  it('carries the filters across a trip to another tab', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...getsJob(JOB),
      ...listsJobApplications([AMAL, BASSEL, CARLA]),
    );

    const { router, user } = await renderApp(`/jobs/${JOB.id}?screening=qualified`);

    expect(await screen.findByText('Amal Haddad')).toBeVisible();

    await user.click(screen.getByRole('tab', { name: 'Tracked links' }));
    await waitFor(() =>
      expect(router.state.location.search).toEqual({ tab: 'links', screening: 'qualified' }),
    );

    await user.click(screen.getByRole('tab', { name: 'Applications' }));

    expect(await screen.findByText('Amal Haddad')).toBeVisible();
    expect(segment('Screening', 'Qualified')).toHaveAttribute('aria-pressed', 'true');
  });
});
