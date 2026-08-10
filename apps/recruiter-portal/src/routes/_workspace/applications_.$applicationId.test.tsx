import { screen, waitFor, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { PipelineStatus } from '@/features/applications/application';
import { AMAL_REVIEW, MOVE_REFUSED } from '@/features/applications/testing/fixtures';
import {
  failsToGetApplication,
  getsApplication,
  refusesApplicationMove,
  reviewsApplication,
} from '@/features/applications/testing/handlers';
import { signedInAs } from '@/features/auth/testing/handlers';
import { absoluteDateTime } from '@/lib/dates';
import { RECRUITER, SERVER_FAULT } from '@/testing/fixtures';
import { renderApp } from '@/testing/render-app';
import { server } from '@/testing/server';

const REVIEW = AMAL_REVIEW;

function section(name: string) {
  return within(screen.getByRole('region', { name }));
}

function panelOrder() {
  return screen.getAllByRole('region').map((panel) => panel.querySelector('h2')?.textContent);
}

function pipelineNow() {
  return within(screen.getByRole('region', { name: 'Pipeline' })).getByRole('listitem', {
    current: 'step',
  });
}

function headerIcon(name: string) {
  return screen.getByRole('region', { name }).querySelector('[data-slot="card-header"] svg');
}

function trail() {
  return within(screen.getByRole('navigation', { name: 'breadcrumb' }));
}

function inUrl(chosen: readonly string[]) {
  return encodeURIComponent(JSON.stringify(chosen));
}

function applicationHeader() {
  const header = screen
    .getByRole('heading', { level: 1, name: REVIEW.snapshot.full_name })
    .closest('header');
  if (!header) throw new Error('The Application heading is not inside its header.');
  return within(header);
}

async function chooseMove(user: UserEvent, label: string) {
  const direct = screen.queryByRole('button', { name: label });
  if (direct) {
    await user.click(direct);
    return;
  }
  await user.click(screen.getByRole('button', { name: 'More moves' }));
  await user.click(await screen.findByRole('menuitem', { name: new RegExp(label) }));
}

describe('the Application review page', () => {
  it('names the candidate, the Job it answers, and where it stands', async () => {
    server.use(...signedInAs(RECRUITER), ...getsApplication(REVIEW));

    await renderApp(`/applications/${REVIEW.id}`);

    expect(await screen.findByRole('heading', { level: 1, name: 'Amal Haddad' })).toBeVisible();
    expect(screen.getByText('Field logistics lead')).toBeVisible();

    const facts = within(screen.getByLabelText('Application facts'));
    expect(facts.getByRole('link', { name: 'Field Coordinator' })).toHaveAttribute(
      'href',
      `/jobs/${REVIEW.job.id}?tab=applications`,
    );
    expect(facts.getByText(absoluteDateTime(REVIEW.applied_at))).toBeVisible();
    expect(facts.getByText(absoluteDateTime(REVIEW.updated_at))).toBeVisible();
  });

  it('reads the Screening verdict with the criteria that decided it', async () => {
    const reason = 'React is required and the application does not list it';
    server.use(
      ...signedInAs(RECRUITER),
      ...getsApplication({ ...REVIEW, screening: { status: 'disqualified', reason } }),
    );

    await renderApp(`/applications/${REVIEW.id}`);

    const screening = section('Screening');
    expect(await screen.findByRole('region', { name: 'Screening' })).toBeVisible();
    expect(screening.getByText('Disqualified')).toBeVisible();
    expect(screening.getByText(reason)).toBeVisible();
  });

  it('leaves a Qualified verdict unexplained rather than claiming Screening never ran', async () => {
    server.use(...signedInAs(RECRUITER), ...getsApplication(REVIEW));

    await renderApp(`/applications/${REVIEW.id}`);

    const screening = section('Screening');
    expect(await screen.findByRole('region', { name: 'Screening' })).toBeVisible();
    expect(screening.getByText('Qualified')).toBeVisible();
    expect(screening.queryByText(/Screening has not run/)).toBeNull();
  });

  it('renders the reviewed profile as the candidate froze it', async () => {
    server.use(...signedInAs(RECRUITER), ...getsApplication(REVIEW));

    await renderApp(`/applications/${REVIEW.id}`);

    const snapshot = within(await screen.findByRole('region', { name: 'Snapshot' }));
    expect(
      snapshot.getByText(
        'What the candidate reviewed when they applied — not their profile as it stands today.',
      ),
    ).toBeVisible();
    expect(
      snapshot.getByText('Nine years moving relief cargo across northern Syria.'),
    ).toBeVisible();
    expect(snapshot.getByText('Aleppo')).toBeVisible();

    expect(snapshot.getByText('Logistics Coordinator')).toBeVisible();
    expect(snapshot.getByText('Hand in Hand')).toBeVisible();
    expect(snapshot.getByText('Mar 2022 – Present')).toBeVisible();
    expect(
      snapshot.getByText('Runs the Aleppo warehouse and its four field routes.'),
    ).toBeVisible();
    expect(snapshot.getByText('Jan 2018 – Feb 2022')).toBeVisible();

    expect(snapshot.getByText('University of Aleppo')).toBeVisible();
    expect(snapshot.getByText('BSc, Civil Engineering')).toBeVisible();
    expect(snapshot.getByText('2017')).toBeVisible();

    expect(snapshot.getByText('PostgreSQL')).toBeVisible();
    expect(snapshot.getByText('3 years')).toBeVisible();
    expect(snapshot.getByText('Python')).toBeVisible();
    expect(snapshot.getByText('1 year')).toBeVisible();

    expect(snapshot.getByText('Arabic')).toBeVisible();
    expect(snapshot.getByText('Native')).toBeVisible();
    expect(snapshot.getByText('English')).toBeVisible();
    expect(snapshot.getByText('Advanced')).toBeVisible();

    expect(snapshot.getByText('Cold-chain pilot')).toBeVisible();
    expect(snapshot.getByText('Jun 2024 – Nov 2024')).toBeVisible();
    expect(snapshot.getByRole('link', { name: 'Cold-chain pilot' })).toHaveAttribute(
      'href',
      'https://example.test/cold-chain',
    );
  });

  it('integrates the applicant and their avatar into the page header', async () => {
    server.use(...signedInAs(RECRUITER), ...getsApplication(REVIEW));

    await renderApp(`/applications/${REVIEW.id}`);

    const header = applicationHeader();
    expect(header.getByRole('heading', { level: 1, name: 'Amal Haddad' })).toBeVisible();
    expect(header.getByText('AH')).toBeVisible();
    expect(header.getByText('Logistics Manager')).toBeVisible();
    expect(header.getByText('Field logistics lead')).toBeVisible();
    expect(header.getByText('+963 11 555 0101')).toBeVisible();
    expect(header.getByText('9 years experience')).toBeVisible();
  });

  it('reaches the applicant by the address the account confirmed, which no Snapshot holds', async () => {
    server.use(...signedInAs(RECRUITER), ...getsApplication(REVIEW));

    await renderApp(`/applications/${REVIEW.id}`);

    expect(applicationHeader().getByText('amal.haddad@example.test')).toBeVisible();
  });

  it('leads from the Application to the Candidate as they are today', async () => {
    server.use(...signedInAs(RECRUITER), ...getsApplication(REVIEW));

    await renderApp(`/applications/${REVIEW.id}`);

    const jump = await screen.findByRole('link', { name: 'Live candidate profile' });
    expect(jump).toHaveAttribute(
      'href',
      `/candidates/${REVIEW.candidate.id}?from=application.${REVIEW.id}`,
    );
    expect(jump).toHaveClass('border-input', 'bg-input-background');
  });

  it('retraces the Job the reader came through, not the section that owns the address', async () => {
    server.use(...signedInAs(RECRUITER), ...getsApplication(REVIEW));

    await renderApp(`/applications/${REVIEW.id}?from=job`);

    const crumbs = trail();
    expect(await crumbs.findByRole('link', { name: 'Jobs' })).toHaveAttribute('href', '/jobs');
    expect(crumbs.getByRole('link', { name: 'Field Coordinator' })).toHaveAttribute(
      'href',
      `/jobs/${REVIEW.job.id}?tab=applications`,
    );
    expect(crumbs.getByText('Amal Haddad')).toBeVisible();
  });

  it('gives the Applications crumb back the reading the reader left', async () => {
    server.use(...signedInAs(RECRUITER), ...getsApplication(REVIEW));

    await renderApp(
      `/applications/${REVIEW.id}?screening=${inUrl(['qualified'])}&received=7d&sort=oldest`,
    );

    expect(await trail().findByRole('link', { name: 'Applications' })).toHaveAttribute(
      'href',
      `/applications?screening=${inUrl(['qualified'])}&received=7d&sort=oldest`,
    );
  });

  it('gives the Job crumb back only the filters that Job’s Applications tab knows', async () => {
    server.use(...signedInAs(RECRUITER), ...getsApplication(REVIEW));

    await renderApp(
      `/applications/${REVIEW.id}?from=job&screening=${inUrl(['qualified'])}&received=7d&sort=oldest`,
    );

    expect(await trail().findByRole('link', { name: 'Field Coordinator' })).toHaveAttribute(
      'href',
      `/jobs/${REVIEW.job.id}?screening=${inUrl(['qualified'])}&tab=applications`,
    );
  });

  it('retraces the Dashboard the reader came through', async () => {
    server.use(...signedInAs(RECRUITER), ...getsApplication(REVIEW));

    await renderApp(`/applications/${REVIEW.id}?from=dashboard`);

    const crumbs = trail();
    expect(await crumbs.findByRole('link', { name: 'Dashboard' })).toHaveAttribute(
      'href',
      '/dashboard',
    );
    expect(crumbs.getByText('Amal Haddad')).toBeVisible();
  });

  it('falls back to the section that owns the address when nothing says where the reader came from', async () => {
    server.use(...signedInAs(RECRUITER), ...getsApplication(REVIEW));

    await renderApp(`/applications/${REVIEW.id}`);

    const crumbs = trail();
    expect(await crumbs.findByRole('link', { name: 'Applications' })).toHaveAttribute(
      'href',
      '/applications',
    );
    expect(crumbs.queryByRole('link', { name: 'Field Coordinator' })).toBeNull();
  });

  it('ignores an origin the workspace does not recognise', async () => {
    server.use(...signedInAs(RECRUITER), ...getsApplication(REVIEW));

    await renderApp(`/applications/${REVIEW.id}?from=somewhere-else`);

    expect(await trail().findByRole('link', { name: 'Applications' })).toHaveAttribute(
      'href',
      '/applications',
    );
  });

  it('marks the candidate identity as the Application Snapshot', async () => {
    server.use(...signedInAs(RECRUITER), ...getsApplication(REVIEW));

    await renderApp(`/applications/${REVIEW.id}`);

    expect(applicationHeader().getByText('Snapshot')).toBeVisible();
  });

  it('names the role they applied as, not whatever they call themselves today', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...getsApplication({
        ...REVIEW,
        snapshot: { ...REVIEW.snapshot, canonical_role: 'Warehouse Officer' },
      }),
    );

    await renderApp(`/applications/${REVIEW.id}`);

    const header = applicationHeader();
    expect(header.getByText('Warehouse Officer')).toBeVisible();
    expect(header.queryByText('Logistics Manager')).toBeNull();
  });

  it('shows the skills Screening could not read, because a human still should', async () => {
    server.use(...signedInAs(RECRUITER), ...getsApplication(REVIEW));

    await renderApp(`/applications/${REVIEW.id}`);

    const snapshot = within(await screen.findByRole('region', { name: 'Snapshot' }));
    expect(snapshot.getByRole('heading', { name: 'Other skills' })).toBeVisible();

    const other = within(snapshot.getByRole('list', { name: 'Other skills' }));
    expect(other.getByText('Convoy planning')).toBeVisible();
    expect(other.getByText('Customs clearance')).toBeVisible();
  });

  it('leaves out the parts of a Snapshot the candidate never filled in', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...getsApplication({
        ...REVIEW,
        snapshot: {
          full_name: 'Amal Haddad',
          headline: 'Field logistics lead',
          total_experience_years: 9,
        },
      }),
    );

    await renderApp(`/applications/${REVIEW.id}`);

    const snapshot = within(await screen.findByRole('region', { name: 'Snapshot' }));
    for (const heading of ['Experience', 'Education', 'Skills', 'Languages', 'Projects']) {
      expect(snapshot.queryByRole('heading', { name: heading })).toBeNull();
    }
    expect(
      snapshot.getByText('Nothing else was on the profile when this Application was sent.'),
    ).toBeVisible();
  });

  it('makes a project’s repository reachable rather than showing a bare address', async () => {
    server.use(...signedInAs(RECRUITER), ...getsApplication(REVIEW));

    await renderApp(`/applications/${REVIEW.id}`);

    const snapshot = within(await screen.findByRole('region', { name: 'Snapshot' }));
    expect(snapshot.getByRole('link', { name: 'example.test/cold-chain-repo' })).toHaveAttribute(
      'href',
      'https://example.test/cold-chain-repo',
    );
  });

  it("pairs each of the Job's questions with what the candidate answered", async () => {
    server.use(...signedInAs(RECRUITER), ...getsApplication(REVIEW));

    await renderApp(`/applications/${REVIEW.id}`);

    const answers = within(await screen.findByRole('region', { name: 'Answers' }));
    expect(answers.getByText('Do you hold a valid driving licence?')).toBeVisible();
    expect(answers.getByText('Yes')).toBeVisible();
    expect(answers.getByText('Which governorates can you reach within a day?')).toBeVisible();
    expect(answers.getByText('Aleppo, Idlib and Hama.')).toBeVisible();
  });

  it('says so plainly when the Job asked nothing', async () => {
    server.use(...signedInAs(RECRUITER), ...getsApplication({ ...REVIEW, answers: [] }));

    await renderApp(`/applications/${REVIEW.id}`);

    const answers = within(await screen.findByRole('region', { name: 'Answers' }));
    expect(answers.getByText('This Job asked no questions.')).toBeVisible();
  });

  it('says Screening has not run rather than leaving the verdict unexplained', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...getsApplication({ ...REVIEW, screening: { status: 'pending', reason: null } }),
    );

    await renderApp(`/applications/${REVIEW.id}`);

    const screening = section('Screening');
    expect(await screen.findByRole('region', { name: 'Screening' })).toBeVisible();
    expect(screening.getByText('Pending')).toBeVisible();
    expect(screening.getByText('Screening has not run on this Application yet.')).toBeVisible();
  });
});

describe('the CV and the history on the Application review page', () => {
  it('opens the CV the Application was sent with from the page header', async () => {
    server.use(...signedInAs(RECRUITER), ...getsApplication(REVIEW));

    await renderApp(`/applications/${REVIEW.id}`);

    const link = await screen.findByRole('link', { name: 'Open CV' });
    expect(link).toHaveAttribute('href', REVIEW.cv.download_url);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveClass('border-input', 'bg-input-background');
  });

  it('leads the review column with the Pipeline and files the Notes beside it', async () => {
    server.use(...signedInAs(RECRUITER), ...getsApplication(REVIEW));

    await renderApp(`/applications/${REVIEW.id}`);

    await screen.findByRole('region', { name: 'Pipeline' });
    const panels = panelOrder();
    expect(panels.indexOf('Pipeline')).toBeLessThan(panels.indexOf('Screening'));
    expect(panels.indexOf('Screening')).toBeLessThan(panels.indexOf('Snapshot'));
    expect(panels.indexOf('Snapshot')).toBeLessThan(panels.indexOf('Tags'));
    expect(panels.indexOf('Notes')).toBe(panels.indexOf('Tags') + 1);
    expect(panels.indexOf('Notes')).toBeLessThan(panels.indexOf('Message the applicant'));
  });

  it('marks the CV action and the Applicant message header with an icon apiece', async () => {
    server.use(...signedInAs(RECRUITER), ...getsApplication(REVIEW));

    await renderApp(`/applications/${REVIEW.id}`);

    expect(
      (await screen.findByRole('link', { name: 'Open CV' })).querySelector('svg'),
    ).toHaveAttribute('aria-hidden', 'true');
    expect(headerIcon('Message the applicant')).toHaveAttribute('aria-hidden', 'true');
  });

  it('tells the whole story of the Application, oldest move first', async () => {
    server.use(...signedInAs(RECRUITER), ...getsApplication(REVIEW));

    await renderApp(`/applications/${REVIEW.id}`);

    const history = within(await screen.findByRole('region', { name: 'History' }));
    expect(history.getAllByRole('listitem').map((entry) => entry.textContent)).toEqual([
      `Applied${absoluteDateTime(REVIEW.applied_at)}by the candidate`,
      `Moved to Reviewing${absoluteDateTime('2026-08-02T11:00:00Z')}from New · by a recruiter`,
      `Moved to Shortlisted${absoluteDateTime('2026-08-02T14:30:00Z')}from Reviewing · by a recruiter`,
    ]);
  });

  it('keeps a long history to its last six moves until the reader asks for the rest', async () => {
    const moves = ['reviewing', 'shortlisted', 'interview', 'offer', 'hired'] as const;
    const history = [
      {
        status: 'new' as const,
        previous_status: null,
        source: 'candidate' as const,
        changed_at: REVIEW.applied_at,
      },
      ...Array.from({ length: 8 }, (_, turn) => ({
        status: moves[turn % moves.length] as (typeof moves)[number],
        previous_status: moves[(turn + 1) % moves.length] as (typeof moves)[number],
        source: 'recruiter' as const,
        changed_at: `2026-08-0${(turn % 8) + 1}T1${turn}:00:00Z`,
      })),
    ];
    server.use(...signedInAs(RECRUITER), ...getsApplication({ ...REVIEW, history }));

    const { user } = await renderApp(`/applications/${REVIEW.id}`);

    const card = within(await screen.findByRole('region', { name: 'History' }));
    expect(card.getAllByRole('listitem')).toHaveLength(6);
    expect(card.queryByText('Applied')).toBeNull();

    await user.click(card.getByRole('button', { name: 'Show 3 earlier moves' }));

    expect(card.getAllByRole('listitem')).toHaveLength(9);
    expect(card.getByText('Applied')).toBeVisible();

    await user.click(card.getByRole('button', { name: 'Show fewer' }));

    expect(card.getAllByRole('listitem')).toHaveLength(6);
  });

  it('adds the move it has just made to the history', async () => {
    server.use(...signedInAs(RECRUITER), ...reviewsApplication(REVIEW));

    const { user } = await renderApp(`/applications/${REVIEW.id}`);

    await chooseMove(user, 'Move to Offer');

    const history = within(screen.getByRole('region', { name: 'History' }));
    expect(await history.findByText('Moved to Offer')).toBeVisible();
    expect(history.getByText('from Shortlisted · by a recruiter')).toBeVisible();
  });
});

describe('reaching an Application by its address', () => {
  it('opens straight from a pasted link and titles the tab for the candidate', async () => {
    server.use(...signedInAs(RECRUITER), ...getsApplication(REVIEW));

    await renderApp(`/applications/${REVIEW.id}`);

    expect(await screen.findByRole('heading', { level: 1, name: 'Amal Haddad' })).toBeVisible();
    await waitFor(() => expect(document.title).toBe('Amal Haddad · Sync Recruiter'));
  });

  it('shows a friendly not-found for an Application this Tenant does not have', async () => {
    server.use(...signedInAs(RECRUITER), ...getsApplication(REVIEW));

    await renderApp('/applications/00000000-0000-4000-8000-000000000999');

    expect(await screen.findByRole('heading', { name: 'Application not found' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Back to Jobs' })).toHaveAttribute('href', '/jobs');
    expect(screen.getByRole('banner')).toBeVisible();
  });

  it('reports a failed read as a route error rather than an empty page', async () => {
    server.use(...signedInAs(RECRUITER), ...failsToGetApplication(SERVER_FAULT));

    await renderApp(`/applications/${REVIEW.id}`);

    expect(await screen.findByText("This page didn't load")).toBeVisible();
    expect(screen.getByText('Something went wrong on our side.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeVisible();
  });
});

describe('the Pipeline on the Application review page', () => {
  it('shows only the adjacent moves and keeps every other allowed move in a menu', async () => {
    server.use(...signedInAs(RECRUITER), ...getsApplication(REVIEW));

    const { user } = await renderApp(`/applications/${REVIEW.id}`);

    const pipeline = within(await screen.findByRole('region', { name: 'Pipeline' }));
    expect(pipelineNow()).toHaveTextContent('Shortlisted');
    expect(pipeline.queryByText(/Stage changes are visible/)).toBeNull();
    expect(pipeline.getByRole('button', { name: 'Move back to Reviewing' })).toBeVisible();
    expect(pipeline.getByRole('button', { name: 'Move to Interview' })).toBeVisible();
    expect(pipeline.getByRole('button', { name: 'More moves' })).toBeVisible();
    expect(pipeline.getAllByRole('button')).toHaveLength(3);

    await user.click(pipeline.getByRole('button', { name: 'More moves' }));
    for (const label of ['Move to Offer', 'Mark as hired', 'Move back to New', 'Reject']) {
      expect(await screen.findByRole('menuitem', { name: new RegExp(label) })).toBeVisible();
    }
  });

  it('names where the Application stands without numbering the Pipeline', async () => {
    server.use(...signedInAs(RECRUITER), ...getsApplication(REVIEW));

    await renderApp(`/applications/${REVIEW.id}`);

    const pipeline = within(await screen.findByRole('region', { name: 'Pipeline' }));
    expect(pipeline.getByText('now')).toBeVisible();
    expect(pipeline.queryByText(/^Step \d+ of \d+$/)).toBeNull();
  });

  it('leaves a rejected Application unnumbered, because it stands off the way through', async () => {
    server.use(...signedInAs(RECRUITER), ...getsApplication({ ...REVIEW, status: 'rejected' }));

    await renderApp(`/applications/${REVIEW.id}`);

    const pipeline = within(await screen.findByRole('region', { name: 'Pipeline' }));
    expect(pipeline.getByText('Rejected')).toBeVisible();
    expect(pipeline.queryByText(/^Step \d+ of \d+$/)).toBeNull();
  });

  it('keeps stage numbers out of the adjacent moves, and ends the row on the onward move', async () => {
    server.use(...signedInAs(RECRUITER), ...getsApplication(REVIEW));

    await renderApp(`/applications/${REVIEW.id}`);

    const pipeline = within(await screen.findByRole('region', { name: 'Pipeline' }));
    expect(pipeline.getAllByRole('button').map((move) => move.textContent)).toEqual([
      'More moves',
      'Move back to Reviewing',
      'Move to Interview',
    ]);
  });

  it('keeps non-adjacent moves out of the primary action row', async () => {
    server.use(...signedInAs(RECRUITER), ...getsApplication(REVIEW));

    await renderApp(`/applications/${REVIEW.id}`);

    const pipeline = within(await screen.findByRole('region', { name: 'Pipeline' }));
    expect(pipeline.queryByRole('button', { name: 'Move to Offer' })).toBeNull();
    expect(pipeline.queryByRole('button', { name: 'Reject' })).toBeNull();
  });

  it('uses one directional icon per move and keeps Reject destructive', async () => {
    server.use(...signedInAs(RECRUITER), ...getsApplication(REVIEW));

    const { user } = await renderApp(`/applications/${REVIEW.id}`);

    const pipeline = within(await screen.findByRole('region', { name: 'Pipeline' }));
    for (const move of pipeline.getAllByRole('button')) {
      expect(move.querySelectorAll('svg')).toHaveLength(1);
    }
    expect(
      pipeline.getByRole('button', { name: 'Move back to Reviewing' }).querySelector('svg'),
    ).toHaveClass('lucide-arrow-left');
    expect(
      pipeline.getByRole('button', { name: 'Move to Interview' }).querySelector('svg'),
    ).toHaveClass('lucide-arrow-right');
    await user.click(pipeline.getByRole('button', { name: 'More moves' }));
    expect(await screen.findByRole('menuitem', { name: /^Reject/ })).toHaveAttribute(
      'data-variant',
      'destructive',
    );
  });

  it('moves the Application, says the candidate was told, and re-reads where it stands', async () => {
    const asked: PipelineStatus[] = [];
    server.use(...signedInAs(RECRUITER), ...reviewsApplication(REVIEW, asked));

    const { user } = await renderApp(`/applications/${REVIEW.id}`);

    await chooseMove(user, 'Move to Interview');

    expect(
      await screen.findByText('Moved to Interview — the candidate has been told.'),
    ).toBeVisible();
    expect(asked).toEqual(['interview']);

    const pipeline = within(screen.getByRole('region', { name: 'Pipeline' }));
    await waitFor(() => expect(pipelineNow()).toHaveTextContent('Interview'));
    expect(pipeline.queryByRole('button', { name: 'Move to Interview' })).toBeNull();
    expect(pipeline.getByRole('button', { name: 'Move back to Shortlisted' })).toBeVisible();
  });

  it.each([
    ['new', 'Move to Reviewing', 'reviewing'],
    ['new', 'Move to Shortlisted', 'shortlisted'],
    ['shortlisted', 'Move to Interview', 'interview'],
    ['shortlisted', 'Move to Offer', 'offer'],
    ['shortlisted', 'Mark as hired', 'hired'],
    ['shortlisted', 'Reject', 'rejected'],
    ['shortlisted', 'Move back to Reviewing', 'reviewing'],
    ['shortlisted', 'Move back to New', 'new'],
    ['interview', 'Move back to Shortlisted', 'shortlisted'],
    ['offer', 'Move back to Interview', 'interview'],
  ] as const)('sends "%s → %s" as the status %s', async (from, label, target) => {
    const asked: PipelineStatus[] = [];
    server.use(...signedInAs(RECRUITER), ...reviewsApplication({ ...REVIEW, status: from }, asked));

    const { user } = await renderApp(`/applications/${REVIEW.id}`);

    await chooseMove(user, label);

    await waitFor(() => expect(asked).toEqual([target]));
  });

  it('offers a rejected Application the one way back, and says a rejection was emailed', async () => {
    const asked: PipelineStatus[] = [];
    server.use(
      ...signedInAs(RECRUITER),
      ...reviewsApplication({ ...REVIEW, status: 'rejected' }, asked),
    );

    const { user } = await renderApp(`/applications/${REVIEW.id}`);

    const pipeline = within(await screen.findByRole('region', { name: 'Pipeline' }));
    expect(pipeline.getAllByRole('button').map((move) => move.textContent)).toEqual(['More moves']);

    await chooseMove(user, 'Reopen for review');

    expect(
      await screen.findByText('Reopened for review — the candidate has been told.'),
    ).toBeVisible();
    await waitFor(() => expect(asked).toEqual(['reviewing']));
  });

  it("puts the server's reason for refusing beside the action, and leaves the status alone", async () => {
    server.use(...signedInAs(RECRUITER), ...refusesApplicationMove(REVIEW, MOVE_REFUSED));

    const { user } = await renderApp(`/applications/${REVIEW.id}`);

    await chooseMove(user, 'Move back to New');

    const pipeline = within(screen.getByRole('region', { name: 'Pipeline' }));
    expect(await pipeline.findByRole('alert')).toHaveTextContent(
      'A shortlisted application cannot become new.',
    );
    expect(pipelineNow()).toHaveTextContent('Shortlisted');
    expect(pipeline.getByRole('button', { name: 'More moves' })).toBeVisible();
  });

  it('names the move it could not make when the server refuses without saying why', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...refusesApplicationMove(REVIEW, { ...MOVE_REFUSED, detail: null }),
    );

    const { user } = await renderApp(`/applications/${REVIEW.id}`);

    await chooseMove(user, 'Mark as hired');

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent("This Application couldn't move to Hired.");
    expect(alert).not.toHaveTextContent('Conflict');
  });

  it('drops the refusal once a move the platform allows goes through', async () => {
    server.use(...signedInAs(RECRUITER), ...refusesApplicationMove(REVIEW, MOVE_REFUSED));

    const { user } = await renderApp(`/applications/${REVIEW.id}`);

    await chooseMove(user, 'Move back to New');
    expect(await screen.findByRole('alert')).toBeVisible();

    server.use(...reviewsApplication(REVIEW));
    await user.click(screen.getByRole('button', { name: 'Move to Interview' }));

    expect(
      await screen.findByText('Moved to Interview — the candidate has been told.'),
    ).toBeVisible();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('reads a hired Application as closed, with nothing left to press', async () => {
    server.use(...signedInAs(RECRUITER), ...getsApplication({ ...REVIEW, status: 'hired' }));

    await renderApp(`/applications/${REVIEW.id}`);

    const pipeline = within(await screen.findByRole('region', { name: 'Pipeline' }));
    expect(pipelineNow()).toHaveTextContent('Hired');
    expect(
      pipeline.getByText('Hired. This Application is closed — nothing moves it.'),
    ).toBeVisible();
    expect(pipeline.queryAllByRole('button')).toEqual([]);
  });

  it('reads a withdrawal as the candidate’s own move, with nothing left to press', async () => {
    server.use(...signedInAs(RECRUITER), ...getsApplication({ ...REVIEW, status: 'withdrawn' }));

    await renderApp(`/applications/${REVIEW.id}`);

    const pipeline = within(await screen.findByRole('region', { name: 'Pipeline' }));
    expect(pipeline.getByText('Withdrawn')).toBeVisible();
    expect(
      pipeline.getByText(
        'The candidate withdrew. That was theirs to do, and nothing moves it now.',
      ),
    ).toBeVisible();
    expect(pipeline.queryAllByRole('button')).toEqual([]);
  });
});
