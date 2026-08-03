import { screen, waitFor, within } from '@testing-library/react';
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

describe('the Application review page', () => {
  it('names the candidate, the Job it answers, and where it stands', async () => {
    server.use(...signedInAs(RECRUITER), ...getsApplication(REVIEW));

    await renderApp(`/applications/${REVIEW.id}`);

    expect(await screen.findByRole('heading', { level: 1, name: 'Amal Haddad' })).toBeVisible();
    expect(screen.getByText('Field logistics lead')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Back to Field Coordinator' })).toBeVisible();

    const facts = within(screen.getByLabelText('Application facts'));
    expect(facts.getByText(absoluteDateTime(REVIEW.applied_at))).toBeVisible();
    expect(facts.getByText(absoluteDateTime(REVIEW.updated_at))).toBeVisible();
  });

  it('reads the Screening verdict with the criteria that decided it', async () => {
    server.use(...signedInAs(RECRUITER), ...getsApplication(REVIEW));

    await renderApp(`/applications/${REVIEW.id}`);

    const screening = section('Screening');
    expect(await screen.findByRole('region', { name: 'Screening' })).toBeVisible();
    expect(screening.getByText('Qualified')).toBeVisible();
    expect(screening.getByText('Meets every required skill and both languages.')).toBeVisible();
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
    expect(snapshot.getByText('+963 11 555 0101')).toBeVisible();

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

  it('flags the skills Screening could not read, because a human still should', async () => {
    server.use(...signedInAs(RECRUITER), ...getsApplication(REVIEW));

    await renderApp(`/applications/${REVIEW.id}`);

    const snapshot = within(await screen.findByRole('region', { name: 'Snapshot' }));
    expect(snapshot.getByText('Convoy planning')).toBeVisible();
    expect(snapshot.getByText('Customs clearance')).toBeVisible();
    expect(
      snapshot.getByText(
        'The platform has no Canonical name for these, so Screening never read them.',
      ),
    ).toBeVisible();
  });

  it('leaves out the parts of a Snapshot the candidate never filled in', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...getsApplication({ ...REVIEW, snapshot: { full_name: 'Amal Haddad' } }),
    );

    await renderApp(`/applications/${REVIEW.id}`);

    const snapshot = within(await screen.findByRole('region', { name: 'Snapshot' }));
    for (const heading of ['Experience', 'Education', 'Skills', 'Languages', 'Projects']) {
      expect(snapshot.queryByRole('heading', { name: heading })).toBeNull();
    }
    expect(
      snapshot.getByText('This Snapshot carries nothing but the candidate’s name.'),
    ).toBeVisible();
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
  it('links the CV the Application was sent with, by the name the candidate gave it', async () => {
    server.use(...signedInAs(RECRUITER), ...getsApplication(REVIEW));

    await renderApp(`/applications/${REVIEW.id}`);

    const cv = within(await screen.findByRole('region', { name: 'CV' }));
    const link = cv.getByRole('link', { name: 'amal-haddad-cv.pdf' });
    expect(link).toHaveAttribute('href', REVIEW.cv.download_url);
    expect(link).toHaveAttribute('target', '_blank');
    expect(
      cv.getByText('This link is short-lived — reload the page if it stops working.'),
    ).toBeVisible();
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

  it('adds the move it has just made to the history', async () => {
    server.use(...signedInAs(RECRUITER), ...reviewsApplication(REVIEW));

    const { user } = await renderApp(`/applications/${REVIEW.id}`);

    await user.click(await screen.findByRole('button', { name: 'Move to Offer' }));

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
  it('shows where the Application stands and every move the platform allows from there', async () => {
    server.use(...signedInAs(RECRUITER), ...getsApplication(REVIEW));

    await renderApp(`/applications/${REVIEW.id}`);

    const pipeline = within(await screen.findByRole('region', { name: 'Pipeline' }));
    expect(pipeline.getByText('Shortlisted')).toBeVisible();
    expect(pipeline.getAllByRole('button').map((move) => move.textContent)).toEqual([
      'Move to Interview',
      'Move to Offer',
      'Mark as hired',
      'Reject',
      'Move back to Reviewing',
      'Move back to New',
    ]);
  });

  it('moves the Application, says the candidate was told, and re-reads where it stands', async () => {
    const asked: PipelineStatus[] = [];
    server.use(...signedInAs(RECRUITER), ...reviewsApplication(REVIEW, asked));

    const { user } = await renderApp(`/applications/${REVIEW.id}`);

    await user.click(await screen.findByRole('button', { name: 'Move to Interview' }));

    expect(
      await screen.findByText('Moved to Interview — the candidate has been told.'),
    ).toBeVisible();
    expect(asked).toEqual(['interview']);

    const pipeline = within(screen.getByRole('region', { name: 'Pipeline' }));
    await waitFor(() => expect(pipeline.getByText('Interview')).toBeVisible());
    expect(pipeline.queryByRole('button', { name: 'Move to Interview' })).toBeNull();
    expect(pipeline.getByRole('button', { name: 'Move back to Shortlisted' })).toBeVisible();
  });

  it.each([
    ['Move to Interview', 'interview'],
    ['Move to Offer', 'offer'],
    ['Mark as hired', 'hired'],
    ['Reject', 'rejected'],
    ['Move back to Reviewing', 'reviewing'],
    ['Move back to New', 'new'],
  ] as const)('sends %s as the status %s', async (label, target) => {
    const asked: PipelineStatus[] = [];
    server.use(...signedInAs(RECRUITER), ...reviewsApplication(REVIEW, asked));

    const { user } = await renderApp(`/applications/${REVIEW.id}`);

    await user.click(await screen.findByRole('button', { name: label }));

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
    expect(pipeline.getAllByRole('button').map((move) => move.textContent)).toEqual([
      'Reopen for review',
    ]);

    await user.click(pipeline.getByRole('button', { name: 'Reopen for review' }));

    expect(
      await screen.findByText('Reopened for review — the candidate has been told.'),
    ).toBeVisible();
    await waitFor(() => expect(asked).toEqual(['reviewing']));
  });

  it("puts the server's reason for refusing beside the action, and leaves the status alone", async () => {
    server.use(...signedInAs(RECRUITER), ...refusesApplicationMove(REVIEW, MOVE_REFUSED));

    const { user } = await renderApp(`/applications/${REVIEW.id}`);

    await user.click(await screen.findByRole('button', { name: 'Move back to New' }));

    const pipeline = within(screen.getByRole('region', { name: 'Pipeline' }));
    expect(await pipeline.findByRole('alert')).toHaveTextContent(
      'A shortlisted application cannot become new.',
    );
    expect(pipeline.getByText('Shortlisted')).toBeVisible();
    expect(pipeline.getByRole('button', { name: 'Move back to New' })).toBeVisible();
  });

  it('names the move it could not make when the server refuses without saying why', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...refusesApplicationMove(REVIEW, { ...MOVE_REFUSED, title: '', detail: null }),
    );

    const { user } = await renderApp(`/applications/${REVIEW.id}`);

    await user.click(await screen.findByRole('button', { name: 'Mark as hired' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "This Application couldn't move to Hired.",
    );
  });

  it('drops the refusal once a move the platform allows goes through', async () => {
    server.use(...signedInAs(RECRUITER), ...refusesApplicationMove(REVIEW, MOVE_REFUSED));

    const { user } = await renderApp(`/applications/${REVIEW.id}`);

    await user.click(await screen.findByRole('button', { name: 'Move back to New' }));
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
    expect(pipeline.getByText('Hired')).toBeVisible();
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
