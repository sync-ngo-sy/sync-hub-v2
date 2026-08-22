import { screen, waitFor, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { OPEN_STATUSES, SCREENING_VERDICTS } from '@/features/applications/application';
import {
  AMAL,
  AMAL_MATCH,
  AMAL_REVIEW,
  BASSEL,
  CARLA,
} from '@/features/applications/testing/fixtures';
import {
  type AskedFor,
  failsToListJobApplications,
  getsApplication,
  holdsJobApplications,
  listsJobApplications,
  movesTickedJobApplications,
  pagesJobApplications,
  refusesTheSweep,
  type SweepAskedFor,
  sweepsJobApplications,
} from '@/features/applications/testing/handlers';
import { signedInAs } from '@/features/auth/testing/handlers';
import { FIELD_COORDINATOR_VIEW } from '@/features/jobs/testing/fixtures';
import { getsJob } from '@/features/jobs/testing/handlers';
import { LINKEDIN_POST } from '@/features/tracked-links/testing/fixtures';
import { listsTrackedLinks } from '@/features/tracked-links/testing/handlers';
import { absoluteDateTime, relativeTime } from '@/lib/dates';
import { RECRUITER, SERVER_FAULT } from '@/testing/fixtures';
import { renderApp } from '@/testing/render-app';
import { server } from '@/testing/server';

const JOB = FIELD_COORDINATOR_VIEW;

const EVERY_VERDICT = [...SCREENING_VERDICTS];

const STILL_OPEN = [...OPEN_STATUSES];

function inUrl(chosen: readonly string[]) {
  return encodeURIComponent(JSON.stringify(chosen));
}

function rowOf(candidate: string) {
  return within(screen.getByRole('row', { name: new RegExp(candidate) }));
}

function listedInOrder() {
  return screen
    .getAllByRole('link', { name: /Application$/ })
    .map((open) => open.getAttribute('aria-label'));
}

function screeningTrigger() {
  return screen.getByRole('button', { name: /^Screening: / });
}

async function openScreening(user: UserEvent) {
  await user.click(screeningTrigger());
  await screen.findByRole('menu');
}

function checkItem(label: string) {
  return screen.getByRole('menuitemcheckbox', { name: new RegExp(`^${label}`) });
}

describe("a Job's Applications tab", () => {
  it('lists the Applications the API sent, with both marks and a hoverable received time', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...getsJob(JOB),
      ...listsJobApplications([AMAL, BASSEL, CARLA]),
    );

    await renderApp(`/jobs/${JOB.id}?pipeline=all`);

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

    expect(rowOf('Amal Haddad').getByText('Logistics Manager · 9 years')).toBeVisible();
    expect(rowOf('Amal Haddad').queryByText(/Aleppo/)).toBeNull();
    expect(rowOf('Amal Haddad').queryByText(/Field logistics lead/)).toBeNull();
    expect(rowOf('Amal Haddad').getByText(relativeTime(AMAL.applied_at))).toHaveAttribute(
      'title',
      absoluteDateTime(AMAL.applied_at),
    );
  });

  it('starts on Open, asking for new through offer and leaving the address bar clean', async () => {
    const asked: AskedFor[] = [];
    server.use(
      ...signedInAs(RECRUITER),
      ...getsJob(JOB),
      ...listsJobApplications([AMAL, BASSEL, CARLA], asked),
    );

    const { router } = await renderApp(`/jobs/${JOB.id}`);

    expect(await screen.findByText('Amal Haddad')).toBeVisible();
    expect(screen.getByText('Bassel Nasser')).toBeVisible();
    expect(screen.queryByText('Carla Rizk')).toBeNull();
    expect(asked.every((one) => one.status.join() === STILL_OPEN.join())).toBe(true);
    expect(screen.getByRole('radio', { name: 'Open 2' })).toBeChecked();
    expect(router.state.location.search).toEqual({});
  });

  it('shows the API count on every Pipeline chip', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...getsJob(JOB),
      ...listsJobApplications([AMAL, BASSEL, CARLA]),
    );

    await renderApp(`/jobs/${JOB.id}`);
    expect(await screen.findByText('Amal Haddad')).toBeVisible();

    expect(screen.getByRole('radio', { name: 'Open 2' })).toBeVisible();
    expect(screen.getByRole('radio', { name: 'New 1' })).toBeVisible();
    expect(screen.getByRole('radio', { name: 'Shortlisted 1' })).toBeVisible();
    expect(screen.getByRole('radio', { name: 'Rejected 1' })).toBeVisible();
    expect(screen.getByRole('radio', { name: 'Withdrawn 0' })).toBeVisible();
    expect(screen.getByRole('radio', { name: 'All 3' })).toBeVisible();
  });

  it('opens one Pipeline status and writes it into the address bar', async () => {
    const asked: AskedFor[] = [];
    server.use(
      ...signedInAs(RECRUITER),
      ...getsJob(JOB),
      ...listsJobApplications([AMAL, BASSEL, CARLA], asked),
    );

    const { router, user } = await renderApp(`/jobs/${JOB.id}`);
    expect(await screen.findByText('Amal Haddad')).toBeVisible();

    await user.click(screen.getByRole('radio', { name: 'Rejected 1' }));

    await waitFor(() => expect(router.state.location.search).toEqual({ pipeline: 'rejected' }));
    await waitFor(() => expect(asked.at(-1)?.status).toEqual(['rejected']));
    expect(await screen.findByText('Carla Rizk')).toBeVisible();
    expect(screen.queryByText('Amal Haddad')).toBeNull();
  });

  it('returns to every status when All is picked, and writes All into the address bar', async () => {
    const asked: AskedFor[] = [];
    server.use(
      ...signedInAs(RECRUITER),
      ...getsJob(JOB),
      ...listsJobApplications([AMAL, BASSEL, CARLA], asked),
    );

    const { router, user } = await renderApp(`/jobs/${JOB.id}?pipeline=new`);
    expect(await screen.findByText('Amal Haddad')).toBeVisible();

    await user.click(screen.getByRole('radio', { name: 'All 3' }));

    await waitFor(() => expect(router.state.location.search).toEqual({ pipeline: 'all' }));
    await waitFor(() => expect(asked.at(-1)?.status).toEqual([]));
    expect(await screen.findByText('Carla Rizk')).toBeVisible();
  });

  it('goes back to the working list when Open is picked, and leaves it unwritten', async () => {
    const asked: AskedFor[] = [];
    server.use(
      ...signedInAs(RECRUITER),
      ...getsJob(JOB),
      ...listsJobApplications([AMAL, BASSEL, CARLA], asked),
    );

    const { router, user } = await renderApp(`/jobs/${JOB.id}?pipeline=rejected`);
    expect(await screen.findByText('Carla Rizk')).toBeVisible();

    await user.click(screen.getByRole('radio', { name: 'Open 2' }));

    await waitFor(() => expect(router.state.location.search).toEqual({}));
    await waitFor(() => expect(asked.at(-1)?.status).toEqual(STILL_OPEN));
    expect(await screen.findByText('Amal Haddad')).toBeVisible();
    expect(screen.queryByText('Carla Rizk')).toBeNull();
  });

  it('asks for every verdict until the reader says otherwise', async () => {
    const asked: AskedFor[] = [];
    server.use(
      ...signedInAs(RECRUITER),
      ...getsJob(JOB),
      ...listsJobApplications([AMAL, BASSEL, CARLA], asked),
    );

    await renderApp(`/jobs/${JOB.id}`);

    expect(await screen.findByText('Amal Haddad')).toBeVisible();
    expect(asked.every((one) => one.qualification_status.join() === EVERY_VERDICT.join())).toBe(
      true,
    );
    expect(screeningTrigger()).toHaveAccessibleName('Screening: All verdicts');
  });

  it('counts every verdict, narrowed by what the Pipeline filter is hiding', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...getsJob(JOB),
      ...listsJobApplications([AMAL, BASSEL, CARLA]),
    );

    const { user } = await renderApp(`/jobs/${JOB.id}?pipeline=new`);
    expect(await screen.findByText('Amal Haddad')).toBeVisible();

    await openScreening(user);

    expect(checkItem('Qualified')).toHaveAccessibleName('Qualified, 1');
    expect(checkItem('Review required')).toHaveAccessibleName('Review required, 0');
    expect(checkItem('Pending')).toHaveAccessibleName('Pending, 0');
    expect(checkItem('Disqualified')).toHaveAccessibleName('Disqualified, 0');
    expect(checkItem('Qualified')).toHaveAttribute('aria-checked', 'true');
  });

  it('narrows to one verdict and says so on the trigger', async () => {
    const asked: AskedFor[] = [];
    server.use(
      ...signedInAs(RECRUITER),
      ...getsJob(JOB),
      ...listsJobApplications([AMAL, BASSEL, CARLA], asked),
    );

    const { router, user } = await renderApp(
      `/jobs/${JOB.id}?screening=${inUrl(['qualified', 'review_required'])}`,
    );
    expect(await screen.findByText('Amal Haddad')).toBeVisible();

    await openScreening(user);
    await user.click(checkItem('Review required'));

    await waitFor(() => expect(router.state.location.search).toEqual({ screening: ['qualified'] }));
    await waitFor(() => expect(asked.at(-1)?.qualification_status).toEqual(['qualified']));
    expect(screeningTrigger()).toHaveAccessibleName('Screening: Qualified');
  });

  it('will not let the last checked verdict be unchecked', async () => {
    server.use(...signedInAs(RECRUITER), ...getsJob(JOB), ...listsJobApplications([AMAL]));

    const { user } = await renderApp(`/jobs/${JOB.id}?screening=${inUrl(['qualified'])}`);
    expect(await screen.findByText('Amal Haddad')).toBeVisible();

    await openScreening(user);

    expect(checkItem('Qualified')).toHaveAttribute('aria-disabled', 'true');
    expect(checkItem('Pending')).not.toHaveAttribute('aria-disabled');
  });

  it('puts every verdict back when All verdicts is picked', async () => {
    const asked: AskedFor[] = [];
    server.use(
      ...signedInAs(RECRUITER),
      ...getsJob(JOB),
      ...listsJobApplications([AMAL, BASSEL, CARLA], asked),
    );

    const { router, user } = await renderApp(`/jobs/${JOB.id}?screening=${inUrl(['qualified'])}`);
    expect(await screen.findByText('Amal Haddad')).toBeVisible();

    await openScreening(user);
    await user.click(screen.getByRole('menuitem', { name: 'All verdicts' }));

    await waitFor(() => expect(router.state.location.search).toEqual({ screening: EVERY_VERDICT }));
    await waitFor(() => expect(asked.at(-1)?.qualification_status).toEqual(EVERY_VERDICT));
    expect(await screen.findByText('Bassel Nasser')).toBeVisible();
    expect(screeningTrigger()).toHaveAccessibleName('Screening: All verdicts');
  });

  it('sends both filters to the API at once and leaves them in the address bar', async () => {
    const asked: AskedFor[] = [];
    server.use(
      ...signedInAs(RECRUITER),
      ...getsJob(JOB),
      ...listsJobApplications([AMAL, BASSEL, CARLA], asked),
    );

    const { router, user } = await renderApp(
      `/jobs/${JOB.id}?pipeline=shortlisted&screening=${inUrl(['qualified', 'review_required'])}`,
    );
    expect(await screen.findByText('Bassel Nasser')).toBeVisible();

    await openScreening(user);
    await user.click(checkItem('Qualified'));

    await waitFor(() =>
      expect(router.state.location.search).toEqual({
        pipeline: 'shortlisted',
        screening: ['review_required'],
      }),
    );
    await waitFor(() =>
      expect(asked.at(-1)).toEqual({
        status: ['shortlisted'],
        qualification_status: ['review_required'],
        sort: 'newest',
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

    await renderApp(`/jobs/${JOB.id}?pipeline=rejected&screening=${inUrl(['disqualified'])}`);

    expect(await screen.findByText('Carla Rizk')).toBeVisible();
    expect(screen.queryByText('Amal Haddad')).toBeNull();
    expect(screen.getByRole('radio', { name: 'Rejected 1' })).toBeChecked();
    expect(screeningTrigger()).toHaveAccessibleName('Screening: Disqualified');
    expect(asked.every((one) => one.status.join() === 'rejected')).toBe(true);
    expect(asked.every((one) => one.qualification_status.join() === 'disqualified')).toBe(true);
  });

  it('leaves the other filter alone when only one is set', async () => {
    const asked: AskedFor[] = [];
    server.use(
      ...signedInAs(RECRUITER),
      ...getsJob(JOB),
      ...listsJobApplications([AMAL, BASSEL, CARLA], asked),
    );

    await renderApp(`/jobs/${JOB.id}?screening=${inUrl(['qualified'])}`);

    expect(await screen.findByText('Amal Haddad')).toBeVisible();
    expect(asked.every((one) => one.status.join() === STILL_OPEN.join())).toBe(true);
    expect(asked.every((one) => one.qualification_status.join() === 'qualified')).toBe(true);
    expect(screen.getByRole('radio', { name: 'Open 1' })).toBeChecked();
  });

  it('drops a filter the platform cannot honour rather than failing the page', async () => {
    const asked: AskedFor[] = [];
    server.use(...signedInAs(RECRUITER), ...getsJob(JOB), ...listsJobApplications([AMAL], asked));

    await renderApp(`/jobs/${JOB.id}?pipeline=on-a-yacht&screening=on-a-yacht`);

    expect(await screen.findByText('Amal Haddad')).toBeVisible();
    expect(asked.every((one) => one.status.join() === STILL_OPEN.join())).toBe(true);
    expect(asked.every((one) => one.qualification_status.join() === EVERY_VERDICT.join())).toBe(
      true,
    );
  });

  it('takes the reader to the Application the row stands for', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...getsJob(JOB),
      ...listsJobApplications([AMAL]),
      ...getsApplication(AMAL_REVIEW),
    );

    const { router, user } = await renderApp(`/jobs/${JOB.id}`);

    await user.click(await screen.findByRole('link', { name: "Open Amal Haddad's Application" }));

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
    server.use(
      ...signedInAs(RECRUITER),
      ...getsJob(JOB),
      ...held.handlers,
      ...getsApplication(AMAL_REVIEW),
    );

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
    server.use(
      ...signedInAs(RECRUITER),
      ...getsJob(JOB),
      ...listsJobApplications([]),
      ...listsTrackedLinks([LINKEDIN_POST]),
    );

    const { router, user } = await renderApp(`/jobs/${JOB.id}`);

    expect(
      await screen.findByText(
        'No one has applied yet — a tracked link is the quickest way to bring candidates to this Job.',
      ),
    ).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Go to tracked links' }));

    await waitFor(() => expect(router.state.location.search).toEqual({ tab: 'links' }));
    expect(await screen.findByText(LINKEDIN_POST.name)).toBeVisible();
  });

  it('tells a Job whose every Application ended apart from one nobody applied to', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...getsJob(JOB),
      ...listsJobApplications([CARLA]),
      ...listsTrackedLinks([LINKEDIN_POST]),
    );

    const { router, user } = await renderApp(`/jobs/${JOB.id}`);

    expect(
      await screen.findByText(
        'Nothing on this Job is waiting on a decision — every Application it received has ended.',
      ),
    ).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Go to tracked links' })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Go to all Applications' }));

    await waitFor(() => expect(router.state.location.search).toEqual({ pipeline: 'all' }));
    expect(await screen.findByText('Carla Rizk')).toBeVisible();
  });

  it('says a filtered view is empty because of the filters, and offers to drop them', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...getsJob(JOB),
      ...listsJobApplications([AMAL, BASSEL, CARLA]),
    );

    const { router, user } = await renderApp(
      `/jobs/${JOB.id}?pipeline=new&screening=${inUrl(['review_required'])}`,
    );

    expect(
      await screen.findByText('No Application on this Job matches both filters.'),
    ).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Clear filters' }));

    await waitFor(() => expect(router.state.location.search).toEqual({}));
    expect(await screen.findByText('Bassel Nasser')).toBeVisible();
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

  it('blames the filters on a list whose every count reads zero', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...getsJob(JOB),
      ...listsJobApplications([AMAL, BASSEL, CARLA]),
    );

    const { router, user } = await renderApp(
      `/jobs/${JOB.id}?pipeline=interview&screening=${inUrl(['pending'])}&sort=oldest`,
    );

    expect(
      await screen.findByText('No Application on this Job matches both filters.'),
    ).toBeVisible();
    expect(screen.getByRole('radio', { name: 'All 0' })).toBeVisible();
    expect(screen.getByRole('radio', { name: 'Interview 0' })).toBeVisible();

    await openScreening(user);
    expect(checkItem('Pending')).toHaveAccessibleName('Pending, 0');
    await user.keyboard('{Escape}');

    await user.click(screen.getByRole('button', { name: 'Clear filters' }));

    await waitFor(() => expect(router.state.location.search).toEqual({ sort: 'oldest' }));
    expect(await screen.findByText('Amal Haddad')).toBeVisible();
  });

  it('reads all four verdicts as an untouched filter, and offers no Clear', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...getsJob(JOB),
      ...listsJobApplications([]),
      ...listsTrackedLinks([LINKEDIN_POST]),
    );

    await renderApp(`/jobs/${JOB.id}?screening=${inUrl(EVERY_VERDICT)}`);

    expect(await screen.findByText(/No one has applied yet/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Go to tracked links' })).toBeVisible();
    expect(screen.queryByRole('button', { name: /^Clear filter/ })).toBeNull();
  });

  it('carries the filters across a trip to another tab', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...getsJob(JOB),
      ...listsJobApplications([AMAL, BASSEL, CARLA]),
    );

    const { router, user } = await renderApp(
      `/jobs/${JOB.id}?pipeline=new&screening=${inUrl(['qualified'])}`,
    );

    expect(await screen.findByText('Amal Haddad')).toBeVisible();

    await user.click(screen.getByRole('tab', { name: 'Tracked links' }));
    await waitFor(() =>
      expect(router.state.location.search).toEqual({
        tab: 'links',
        pipeline: 'new',
        screening: ['qualified'],
      }),
    );

    await user.click(screen.getByRole('tab', { name: 'Applications' }));

    expect(await screen.findByText('Amal Haddad')).toBeVisible();
    expect(screen.getByRole('radio', { name: 'New 1' })).toBeChecked();
    expect(screeningTrigger()).toHaveAccessibleName('Screening: Qualified');
  });
});

describe('the Match score on a Job triage list', () => {
  it('shows the score, and says so plainly when nobody has read the Application', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...getsJob(JOB),
      ...listsJobApplications([AMAL, BASSEL, CARLA]),
    );

    await renderApp(`/jobs/${JOB.id}?pipeline=all`);

    expect(await screen.findByText('Amal Haddad')).toBeVisible();
    expect(rowOf('Amal Haddad').getByText('82%')).toBeVisible();
    expect(rowOf('Bassel Nasser').getByText('41%')).toBeVisible();
    expect(rowOf('Carla Rizk').getByText('Not read yet')).toBeVisible();
  });

  it('opens the reasoning on focus alone, so the number is never acted on by itself', async () => {
    server.use(...signedInAs(RECRUITER), ...getsJob(JOB), ...listsJobApplications([AMAL]));

    const { user } = await renderApp(`/jobs/${JOB.id}`);
    expect(await screen.findByText('Amal Haddad')).toBeVisible();

    await user.tab();
    while (document.activeElement?.getAttribute('aria-label') !== '82% strength for this Job') {
      await user.tab();
    }

    expect(await screen.findByText(AMAL_MATCH.explanation as string)).toBeVisible();
    expect(screen.getByText(/gpt-4o-mini/)).toBeVisible();
  });

  it('opens the reasoning on hover', async () => {
    server.use(...signedInAs(RECRUITER), ...getsJob(JOB), ...listsJobApplications([AMAL]));

    const { user } = await renderApp(`/jobs/${JOB.id}`);
    expect(await screen.findByText('Amal Haddad')).toBeVisible();

    await user.hover(screen.getByRole('button', { name: '82% strength for this Job' }));

    expect(await screen.findByText(AMAL_MATCH.explanation as string)).toBeVisible();
  });

  it('says the model gave no reasons rather than showing an empty card', async () => {
    server.use(...signedInAs(RECRUITER), ...getsJob(JOB), ...listsJobApplications([BASSEL]));

    const { user } = await renderApp(`/jobs/${JOB.id}`);
    expect(await screen.findByText('Bassel Nasser')).toBeVisible();

    await user.hover(screen.getByRole('button', { name: '41% strength for this Job' }));

    expect(await screen.findByText('The model gave no reasons for this reading.')).toBeVisible();
  });

  it('asks for the best answered first, which is the only way a fresh score column reads', async () => {
    const asked: AskedFor[] = [];
    server.use(
      ...signedInAs(RECRUITER),
      ...getsJob(JOB),
      ...listsJobApplications([AMAL, BASSEL, CARLA], asked),
    );

    const { router, user } = await renderApp(`/jobs/${JOB.id}?pipeline=all`);
    expect(await screen.findByText('Amal Haddad')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Match' }));

    await waitFor(() =>
      expect(router.state.location.search).toEqual({ pipeline: 'all', sort: 'highest_match' }),
    );
    await waitFor(() => expect(asked.at(-1)?.sort).toBe('highest_match'));
    expect(listedInOrder()).toEqual([
      "Open Amal Haddad's Application",
      "Open Bassel Nasser's Application",
      "Open Carla Rizk's Application",
    ]);
  });

  it('turns the score order around when the column is asked again', async () => {
    const asked: AskedFor[] = [];
    server.use(
      ...signedInAs(RECRUITER),
      ...getsJob(JOB),
      ...listsJobApplications([AMAL, BASSEL, CARLA], asked),
    );

    const { router, user } = await renderApp(`/jobs/${JOB.id}?pipeline=all&sort=highest_match`);
    expect(await screen.findByText('Amal Haddad')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Match' }));

    await waitFor(() =>
      expect(router.state.location.search).toEqual({ pipeline: 'all', sort: 'lowest_match' }),
    );
    await waitFor(() => expect(asked.at(-1)?.sort).toBe('lowest_match'));
    expect(listedInOrder()).toEqual([
      "Open Carla Rizk's Application",
      "Open Bassel Nasser's Application",
      "Open Amal Haddad's Application",
    ]);
  });

  it('leaves the default order out of the address bar', async () => {
    const asked: AskedFor[] = [];
    server.use(
      ...signedInAs(RECRUITER),
      ...getsJob(JOB),
      ...listsJobApplications([AMAL, BASSEL, CARLA], asked),
    );

    const { router } = await renderApp(`/jobs/${JOB.id}`);

    expect(await screen.findByText('Amal Haddad')).toBeVisible();
    expect(router.state.location.search).toEqual({});
    expect(asked.every((one) => one.sort === 'newest')).toBe(true);
  });
});

describe("ending many of a Job's Applications at once", () => {
  function endMany() {
    return screen.getByRole('button', { name: 'End many' });
  }

  function tickOf(status: string, count: number) {
    return screen.getByRole('checkbox', { name: `${status} ${count}` });
  }

  async function openTheModal(user: UserEvent) {
    await user.click(endMany());
    return screen.findByRole('dialog', { name: 'End many Applications' });
  }

  it('lists the five undecided statuses with the counts the list already returned', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...getsJob(JOB),
      ...listsJobApplications([AMAL, BASSEL, CARLA]),
    );

    const { user } = await renderApp(`/jobs/${JOB.id}?pipeline=all`);
    expect(await screen.findByText('Amal Haddad')).toBeVisible();
    const modal = within(await openTheModal(user));

    const boxes = modal.getAllByRole('checkbox');
    expect(boxes).toHaveLength(5);
    expect(boxes[0]).toHaveAccessibleName('New 1');
    expect(boxes[1]).toHaveAccessibleName('Reviewing 0');
    expect(boxes[2]).toHaveAccessibleName('Shortlisted 1');
    expect(boxes[3]).toHaveAccessibleName('Interview 0');
    expect(boxes[4]).toHaveAccessibleName('Offer 0');
    expect(modal.queryByRole('checkbox', { name: /^Rejected/ })).toBeNull();
    expect(modal.queryByRole('checkbox', { name: /^Hired/ })).toBeNull();
  });

  it('adds the ticks up into a running total, and says what one confirm decides', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...getsJob(JOB),
      ...listsJobApplications([AMAL, BASSEL, CARLA]),
    );

    const { user } = await renderApp(`/jobs/${JOB.id}?pipeline=all`);
    expect(await screen.findByText('Amal Haddad')).toBeVisible();
    await openTheModal(user);

    expect(screen.getByRole('status')).toHaveTextContent('Nothing is ticked.');
    expect(screen.getByRole('button', { name: 'End Applications' })).toBeDisabled();

    await user.click(tickOf('New', 1));
    expect(screen.getByRole('status')).toHaveTextContent(
      '1 Application ends. They hear three days from now.',
    );

    await user.click(tickOf('Shortlisted', 1));
    expect(screen.getByRole('status')).toHaveTextContent('2 Applications end.');
    expect(screen.getByRole('button', { name: 'End 2 Applications' })).toBeEnabled();
  });

  it('offers no tick on a status nothing stands in', async () => {
    server.use(...signedInAs(RECRUITER), ...getsJob(JOB), ...listsJobApplications([AMAL]));

    const { user } = await renderApp(`/jobs/${JOB.id}?pipeline=all`);
    expect(await screen.findByText('Amal Haddad')).toBeVisible();
    await openTheModal(user);

    expect(tickOf('New', 1)).not.toHaveAttribute('aria-disabled');
    expect(tickOf('Offer', 0)).toHaveAttribute('aria-disabled', 'true');
  });

  it('sends the Reading and no ids at all, and reports what it ended', async () => {
    const asked: SweepAskedFor[] = [];
    const listed = [AMAL, BASSEL, CARLA];
    server.use(...signedInAs(RECRUITER), ...getsJob(JOB), ...sweepsJobApplications(listed, asked));

    const { user } = await renderApp(`/jobs/${JOB.id}?pipeline=all`);
    expect(await screen.findByText('Amal Haddad')).toBeVisible();
    await openTheModal(user);
    await user.click(tickOf('New', 1));
    await user.click(screen.getByRole('button', { name: 'End 1 Application' }));

    expect(await screen.findByText(/1 Application ended/)).toBeVisible();
    expect(asked).toEqual([{ statuses: ['new'], to: 'rejected', qualification_statuses: null }]);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('leaves the list and its counts saying what the sweep did', async () => {
    const listed = [AMAL, BASSEL, CARLA];
    server.use(...signedInAs(RECRUITER), ...getsJob(JOB), ...sweepsJobApplications(listed));

    const { user } = await renderApp(`/jobs/${JOB.id}`);
    expect(await screen.findByText('Amal Haddad')).toBeVisible();
    await openTheModal(user);
    await user.click(tickOf('New', 1));
    await user.click(tickOf('Shortlisted', 1));
    await user.click(screen.getByRole('button', { name: 'End 2 Applications' }));

    await waitFor(() => expect(screen.queryByText('Amal Haddad')).toBeNull());
    expect(screen.getByRole('radio', { name: /^Rejected/ })).toHaveAccessibleName('Rejected 3');
    expect(screen.getByRole('radio', { name: /^Open/ })).toHaveAccessibleName('Open 0');
  });

  it("carries the Screening filter over, and says the list's filters still apply", async () => {
    const asked: SweepAskedFor[] = [];
    server.use(
      ...signedInAs(RECRUITER),
      ...getsJob(JOB),
      ...sweepsJobApplications([AMAL, BASSEL, CARLA], asked),
    );

    const { user } = await renderApp(
      `/jobs/${JOB.id}?pipeline=all&screening=${inUrl(['qualified'])}`,
    );
    expect(await screen.findByText('Amal Haddad')).toBeVisible();
    await openTheModal(user);

    expect(screen.getByText(/Only the Pipeline tab is replaced/)).toBeVisible();
    await user.click(tickOf('New', 1));
    await user.click(screen.getByRole('button', { name: 'End 1 Application' }));

    expect(await screen.findByText(/1 Application ended/)).toBeVisible();
    expect(asked).toEqual([
      { statuses: ['new'], to: 'rejected', qualification_statuses: ['qualified'] },
    ]);
  });

  it('offers nothing to end on a Job whose Applications have all ended', async () => {
    server.use(...signedInAs(RECRUITER), ...getsJob(JOB), ...listsJobApplications([CARLA]));

    await renderApp(`/jobs/${JOB.id}?pipeline=all`);

    expect(await screen.findByText('Carla Rizk')).toBeVisible();
    expect(endMany()).toBeDisabled();
  });

  it('keeps the modal open and says why when the sweep is refused', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...getsJob(JOB),
      ...refusesTheSweep([AMAL, BASSEL, CARLA], SERVER_FAULT),
    );

    const { user } = await renderApp(`/jobs/${JOB.id}?pipeline=all`);
    expect(await screen.findByText('Amal Haddad')).toBeVisible();
    await openTheModal(user);
    await user.click(tickOf('New', 1));
    await user.click(screen.getByRole('button', { name: 'End 1 Application' }));

    expect(await screen.findByText('Nothing ended')).toBeVisible();
    expect(screen.getByRole('dialog', { name: 'End many Applications' })).toBeVisible();
    expect(screen.getByText('Amal Haddad')).toBeVisible();
  });
});

describe("the ticks on a Job's Applications tab", () => {
  function tickOf(candidate: string) {
    return screen.getByRole('checkbox', { name: `Tick ${candidate}'s Application` });
  }

  function noTickOn(candidate: string) {
    return screen.queryByRole('checkbox', { name: `Tick ${candidate}'s Application` });
  }

  async function openMoveTo(user: UserEvent) {
    await user.click(screen.getByRole('button', { name: /^Move to/ }));
    return within(await screen.findByRole('menu'));
  }

  function pipelineChip(label: string) {
    return screen.getByRole('radio', { name: new RegExp(`^${label}(?: |$)`) });
  }

  it('offers a tick on every row an act reaches, as the Tenant-wide list does', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...getsJob(JOB),
      ...listsJobApplications([AMAL, BASSEL, CARLA]),
    );

    await renderApp(`/jobs/${JOB.id}?pipeline=all`);
    expect(await screen.findByText('Amal Haddad')).toBeVisible();

    expect(tickOf('Amal Haddad')).toBeInTheDocument();
    expect(tickOf('Bassel Nasser')).toBeInTheDocument();
    expect(tickOf('Carla Rizk')).toBeInTheDocument();
  });

  it('offers no box that ticks a whole page, here either', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...getsJob(JOB),
      ...listsJobApplications([AMAL, BASSEL, CARLA]),
    );

    await renderApp(`/jobs/${JOB.id}?pipeline=all`);
    expect(await screen.findByText('Amal Haddad')).toBeVisible();

    expect(screen.getAllByRole('checkbox')).toHaveLength(3);
  });

  it('keeps End many beside the ticks, because a sweep reaches rows no tick has loaded', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...getsJob(JOB),
      ...listsJobApplications([AMAL, BASSEL, CARLA]),
    );

    const { user } = await renderApp(`/jobs/${JOB.id}?pipeline=all`);
    expect(await screen.findByText('Amal Haddad')).toBeVisible();

    await user.click(tickOf('Amal Haddad'));

    expect(screen.getByRole('button', { name: 'End many' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'End 1 Application' })).toBeVisible();
  });

  it('takes the box off a rejected row once an undecided one is ticked', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...getsJob(JOB),
      ...listsJobApplications([AMAL, BASSEL, CARLA]),
    );

    const { user } = await renderApp(`/jobs/${JOB.id}?pipeline=all`);
    expect(await screen.findByText('Amal Haddad')).toBeVisible();

    await user.click(tickOf('Amal Haddad'));

    expect(tickOf('Bassel Nasser')).toBeInTheDocument();
    expect(noTickOn('Carla Rizk')).toBeNull();
  });

  it('offers the ladder moves the whole set admits, and never one to where a row already is', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...getsJob(JOB),
      ...listsJobApplications([AMAL, BASSEL, CARLA]),
    );

    const { user } = await renderApp(`/jobs/${JOB.id}?pipeline=all`);
    expect(await screen.findByText('Amal Haddad')).toBeVisible();
    await user.click(tickOf('Amal Haddad'));
    await user.click(tickOf('Bassel Nasser'));

    const menu = await openMoveTo(user);

    expect(menu.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
      'Reviewing',
      'Interview',
      'Offer',
    ]);
  });

  it('moves the ticked rows up the ladder, one move each, and says where they landed', async () => {
    const asked: string[] = [];
    const listed = [AMAL, BASSEL, CARLA];
    server.use(
      ...signedInAs(RECRUITER),
      ...getsJob(JOB),
      ...movesTickedJobApplications(listed, asked),
    );

    const { user } = await renderApp(`/jobs/${JOB.id}?pipeline=all`);
    expect(await screen.findByText('Amal Haddad')).toBeVisible();
    await user.click(tickOf('Amal Haddad'));
    await user.click(tickOf('Bassel Nasser'));
    const menu = await openMoveTo(user);
    await user.click(menu.getByRole('menuitem', { name: 'Interview' }));
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: 'Move 2 Applications to Interview',
      }),
    );

    expect(await screen.findByText('2 Applications are in Interview.')).toBeVisible();
    expect(asked).toEqual([AMAL.id, BASSEL.id]);
    await waitFor(() => expect(pipelineChip('Interview')).toHaveAccessibleName('Interview 2'));
    expect(screen.queryByRole('button', { name: /^Move to/ })).toBeNull();
  });

  it('promises a ladder move reaches nobody before anybody confirms it', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...getsJob(JOB),
      ...movesTickedJobApplications([AMAL, BASSEL, CARLA]),
    );

    const { user } = await renderApp(`/jobs/${JOB.id}?pipeline=all`);
    expect(await screen.findByText('Amal Haddad')).toBeVisible();
    await user.click(tickOf('Amal Haddad'));
    const menu = await openMoveTo(user);
    await user.click(menu.getByRole('menuitem', { name: 'Shortlisted' }));

    const dialog = within(await screen.findByRole('alertdialog'));
    expect(dialog.getByText(/read as In review to the Candidate/)).toBeVisible();
  });

  it('ends the ticked rows one at a time, which is the act the sweep cannot narrow to', async () => {
    const asked: string[] = [];
    const listed = [AMAL, BASSEL, CARLA];
    server.use(
      ...signedInAs(RECRUITER),
      ...getsJob(JOB),
      ...movesTickedJobApplications(listed, asked),
    );

    const { user } = await renderApp(`/jobs/${JOB.id}?pipeline=all`);
    expect(await screen.findByText('Amal Haddad')).toBeVisible();
    await user.click(tickOf('Bassel Nasser'));
    await user.click(screen.getByRole('button', { name: 'End 1 Application' }));
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: 'End 1 Application',
      }),
    );

    expect(await screen.findByText(/1 Application ended/)).toBeVisible();
    expect(asked).toEqual([BASSEL.id]);
  });

  it('takes a sweep back by ticking the rejections it left', async () => {
    const asked: string[] = [];
    const listed = [AMAL, BASSEL, CARLA];
    server.use(
      ...signedInAs(RECRUITER),
      ...getsJob(JOB),
      ...movesTickedJobApplications(listed, asked),
    );

    const { user } = await renderApp(`/jobs/${JOB.id}?pipeline=all`);
    expect(await screen.findByText('Carla Rizk')).toBeVisible();
    await user.click(tickOf('Carla Rizk'));
    await user.click(screen.getByRole('button', { name: 'Move 1 Application back to Reviewing' }));
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: 'Move 1 Application back to Reviewing',
      }),
    );

    expect(await screen.findByText(/1 Application is back in Reviewing/)).toBeVisible();
    expect(asked).toEqual([CARLA.id]);
  });

  it('drops the ticks when the Reading they were made under changes', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...getsJob(JOB),
      ...listsJobApplications([AMAL, BASSEL, CARLA]),
    );

    const { user } = await renderApp(`/jobs/${JOB.id}?pipeline=all`);
    expect(await screen.findByText('Amal Haddad')).toBeVisible();
    await user.click(tickOf('Amal Haddad'));
    expect(screen.getByRole('status')).toHaveTextContent('1 Application ticked');

    await user.click(pipelineChip('New'));

    await waitFor(() => expect(screen.queryByRole('button', { name: /^End 1 / })).toBeNull());
  });
});
