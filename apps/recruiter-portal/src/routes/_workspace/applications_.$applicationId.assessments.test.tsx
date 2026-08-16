import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  AMAL_REVIEW,
  BARE_ASSESSMENT,
  EARLIER_ASSESSMENT,
  LATEST_ASSESSMENT,
  MODEL_COULD_NOT_ASSESS,
  NO_ASSESSMENT_MODEL,
  TOO_MANY_ASSESSMENTS,
} from '@/features/applications/testing/fixtures';
import {
  assessesMatch,
  failsToAssessMatch,
  failsToListMatchAssessments,
  failsToPageMatchAssessments,
  forgetsMatchAssessments,
  getsApplication,
  holdsMatchAssessment,
  holdsMatchAssessmentDeletion,
  listsMatchAssessments,
  pagesMatchAssessments,
  refusesMatchAssessmentDeletion,
} from '@/features/applications/testing/handlers';
import { signedInAs } from '@/features/auth/testing/handlers';
import { absoluteDateTime } from '@/lib/dates';
import { RECRUITER, SERVER_FAULT } from '@/testing/fixtures';
import { renderApp } from '@/testing/render-app';
import { server } from '@/testing/server';

const REVIEW = AMAL_REVIEW;
const WIDGET = 'Match assessment';

function widget() {
  return within(screen.getByRole('region', { name: WIDGET }));
}

describe('the match assessments already on an Application', () => {
  it('reads every past assessment newest first', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...getsApplication(REVIEW),
      ...listsMatchAssessments([LATEST_ASSESSMENT, EARLIER_ASSESSMENT, BARE_ASSESSMENT]),
    );

    await renderApp(`/applications/${REVIEW.id}`);

    expect(await screen.findByRole('region', { name: WIDGET })).toBeVisible();
    expect(
      widget()
        .getAllByRole('heading', { level: 3 })
        .map((reading) => reading.textContent),
    ).toEqual([
      '82% of what the Job asks for',
      '54% of what the Job asks for',
      '40% of what the Job asks for',
    ]);
  });

  it('says which reading the Job list is sorting this Application by', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...getsApplication(REVIEW),
      ...listsMatchAssessments([LATEST_ASSESSMENT, EARLIER_ASSESSMENT]),
    );

    await renderApp(`/applications/${REVIEW.id}`);

    expect(await screen.findByRole('region', { name: WIDGET })).toBeVisible();
    const [current, earlier] = widget().getAllByRole('listitem');
    expect(within(current as HTMLElement).getByText('Used for the Match score')).toBeVisible();
    expect(within(earlier as HTMLElement).queryByText('Used for the Match score')).toBeNull();
  });

  it('gives each reading its explanation, its strengths and its gaps', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...getsApplication(REVIEW),
      ...listsMatchAssessments([LATEST_ASSESSMENT]),
    );

    await renderApp(`/applications/${REVIEW.id}`);

    const latest = within(await screen.findByRole('listitem', { name: /82%/ }));
    expect(
      latest.getByText('Answers both languages and most of the required skills.'),
    ).toBeVisible();
    expect(latest.getByText('Nine years of field logistics')).toBeVisible();
    expect(latest.getByText('Native Arabic and advanced English')).toBeVisible();
    expect(latest.getByText('No formal procurement training')).toBeVisible();
  });

  it('stamps each reading with when it was written and what wrote it', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...getsApplication(REVIEW),
      ...listsMatchAssessments([LATEST_ASSESSMENT]),
    );

    await renderApp(`/applications/${REVIEW.id}`);

    const latest = within(await screen.findByRole('listitem', { name: /82%/ }));
    expect(latest.getByText(absoluteDateTime(LATEST_ASSESSMENT.assessed_at))).toBeVisible();
    expect(latest.getByText('claude-sonnet-5 · prompt v3')).toBeVisible();
  });

  it('renders a reading that gave a number and nothing else, rather than empty headings', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...getsApplication(REVIEW),
      ...listsMatchAssessments([BARE_ASSESSMENT]),
    );

    await renderApp(`/applications/${REVIEW.id}`);

    const bare = within(await screen.findByRole('listitem', { name: /40%/ }));
    expect(bare.getByText('The model gave no reasons for this reading.')).toBeVisible();
    for (const heading of ['Strengths', 'Gaps']) {
      expect(bare.queryByText(heading)).toBeNull();
    }
  });

  it('says an Application has never been assessed rather than showing an empty list', async () => {
    server.use(...signedInAs(RECRUITER), ...getsApplication(REVIEW), ...listsMatchAssessments([]));

    await renderApp(`/applications/${REVIEW.id}`);

    await waitFor(() =>
      expect(
        widget().getByText('No AI has read this Application against the Job yet.'),
      ).toBeVisible(),
    );
    expect(widget().queryAllByRole('heading', { level: 3 })).toEqual([]);
  });

  it('offers the older readings a page at a time rather than all at once', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...getsApplication(REVIEW),
      ...pagesMatchAssessments([[LATEST_ASSESSMENT], [EARLIER_ASSESSMENT]]),
    );

    const { user } = await renderApp(`/applications/${REVIEW.id}`);

    expect(await screen.findByRole('region', { name: WIDGET })).toBeVisible();
    expect(widget().queryByText('54% of what the Job asks for')).toBeNull();

    await user.click(widget().getByRole('button', { name: 'Show older assessments' }));

    expect(await widget().findByText('54% of what the Job asks for')).toBeVisible();
    expect(widget().queryByRole('button', { name: 'Show older assessments' })).toBeNull();
  });
});

describe('asking an AI to assess a match', () => {
  it('appends the finished assessment to the top of the list, above the older ones', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...getsApplication(REVIEW),
      ...assessesMatch([EARLIER_ASSESSMENT], LATEST_ASSESSMENT),
    );

    const { user } = await renderApp(`/applications/${REVIEW.id}`);

    await user.click(await screen.findByRole('button', { name: 'Ask for an assessment' }));

    await waitFor(() =>
      expect(
        widget()
          .getAllByRole('heading', { level: 3 })
          .map((reading) => reading.textContent),
      ).toEqual(['82% of what the Job asks for', '54% of what the Job asks for']),
    );
  });

  it('says the model is working while it waits, and asks for nothing twice', async () => {
    const held = holdsMatchAssessment([], LATEST_ASSESSMENT);
    server.use(...signedInAs(RECRUITER), ...getsApplication(REVIEW), ...held.handlers);

    const { user } = await renderApp(`/applications/${REVIEW.id}`);

    await user.click(await screen.findByRole('button', { name: 'Ask for an assessment' }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      'The model is reading the Snapshot against the Job. This takes a moment.',
    );
    expect(widget().getByRole('button', { name: 'Reading the Application…' })).toBeDisabled();

    held.arrive();

    expect(await widget().findByText('82% of what the Job asks for')).toBeVisible();
    expect(widget().getByRole('button', { name: 'Ask for an assessment' })).toBeEnabled();
  });

  it('does not claim the Application has never been assessed while it is being assessed', async () => {
    const held = holdsMatchAssessment([], LATEST_ASSESSMENT);
    server.use(...signedInAs(RECRUITER), ...getsApplication(REVIEW), ...held.handlers);

    const { user } = await renderApp(`/applications/${REVIEW.id}`);

    await user.click(await screen.findByRole('button', { name: 'Ask for an assessment' }));

    expect(await screen.findByRole('status')).toBeVisible();
    expect(widget().queryByText('No AI has read this Application against the Job yet.')).toBeNull();

    held.arrive();
    expect(await widget().findByText('82% of what the Job asks for')).toBeVisible();
  });

  it.each([
    ['a tenant that has asked too often', TOO_MANY_ASSESSMENTS, 429 as const],
    ['a model that could not read it', MODEL_COULD_NOT_ASSESS, 502 as const],
    ['a deployment with no model at all', NO_ASSESSMENT_MODEL, 503 as const],
  ])('puts the reason beside the button for %s', async (_case, problem, status) => {
    server.use(
      ...signedInAs(RECRUITER),
      ...getsApplication(REVIEW),
      ...failsToAssessMatch([EARLIER_ASSESSMENT], problem, status),
    );

    const { user } = await renderApp(`/applications/${REVIEW.id}`);

    await user.click(await screen.findByRole('button', { name: 'Ask for an assessment' }));

    expect(await widget().findByRole('alert')).toHaveTextContent(problem.detail as string);
    expect(screen.getByRole('heading', { level: 1, name: 'Amal Haddad' })).toBeVisible();
    expect(widget().getByText('54% of what the Job asks for')).toBeVisible();
  });

  it('names what it could not do when the server refuses without saying why', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...getsApplication(REVIEW),
      ...failsToAssessMatch([], { ...MODEL_COULD_NOT_ASSESS, detail: null }, 502),
    );

    const { user } = await renderApp(`/applications/${REVIEW.id}`);

    await user.click(await screen.findByRole('button', { name: 'Ask for an assessment' }));

    const alert = await widget().findByRole('alert');
    expect(alert).toHaveTextContent("This Application couldn't be assessed. Nothing was recorded.");
    expect(alert).not.toHaveTextContent('Bad Gateway');
  });

  it('drops the refusal once an assessment comes back', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...getsApplication(REVIEW),
      ...failsToAssessMatch([], TOO_MANY_ASSESSMENTS, 429),
    );

    const { user } = await renderApp(`/applications/${REVIEW.id}`);

    await user.click(await screen.findByRole('button', { name: 'Ask for an assessment' }));
    expect(await widget().findByRole('alert')).toBeVisible();

    server.use(...assessesMatch([], LATEST_ASSESSMENT));
    await user.click(widget().getByRole('button', { name: 'Ask for an assessment' }));

    expect(await widget().findByText('82% of what the Job asks for')).toBeVisible();
    expect(widget().queryByRole('alert')).toBeNull();
  });
});

describe('throwing a reading away', () => {
  it('takes the reading off the history and leaves the others where they were', async () => {
    const forgotten: string[] = [];
    server.use(
      ...signedInAs(RECRUITER),
      ...getsApplication(REVIEW),
      ...forgetsMatchAssessments([LATEST_ASSESSMENT, EARLIER_ASSESSMENT], forgotten),
    );

    const { user } = await renderApp(`/applications/${REVIEW.id}`);

    const latest = within(await screen.findByRole('listitem', { name: /82%/ }));
    await user.click(latest.getByRole('button', { name: /^Delete/ }));

    await waitFor(() => expect(widget().queryByText('82% of what the Job asks for')).toBeNull());
    expect(widget().getByText('54% of what the Job asks for')).toBeVisible();
    expect(forgotten).toEqual([LATEST_ASSESSMENT.id]);
  });

  it('leaves the last reading gone and the Application saying it was never assessed', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...getsApplication(REVIEW),
      ...forgetsMatchAssessments([LATEST_ASSESSMENT]),
    );

    const { user } = await renderApp(`/applications/${REVIEW.id}`);

    const latest = within(await screen.findByRole('listitem', { name: /82%/ }));
    await user.click(latest.getByRole('button', { name: /^Delete/ }));

    expect(
      await widget().findByText('No AI has read this Application against the Job yet.'),
    ).toBeVisible();
  });

  it('offers no second deletion while one is still on its way', async () => {
    const held = holdsMatchAssessmentDeletion([LATEST_ASSESSMENT, EARLIER_ASSESSMENT]);
    server.use(...signedInAs(RECRUITER), ...getsApplication(REVIEW), ...held.handlers);

    const { user } = await renderApp(`/applications/${REVIEW.id}`);

    const latest = within(await screen.findByRole('listitem', { name: /82%/ }));
    await user.click(latest.getByRole('button', { name: /^Delete/ }));

    const earlier = within(screen.getByRole('listitem', { name: /54%/ }));
    await waitFor(() => expect(earlier.getByRole('button', { name: /^Delete/ })).toBeDisabled());

    held.arrive();

    await waitFor(() => expect(widget().queryByText('82% of what the Job asks for')).toBeNull());
    expect(widget().getByRole('button', { name: /^Delete/ })).toBeEnabled();
  });

  it('puts the reason beside the reading it could not delete, and keeps the reading', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...getsApplication(REVIEW),
      ...refusesMatchAssessmentDeletion([LATEST_ASSESSMENT, EARLIER_ASSESSMENT], SERVER_FAULT),
    );

    const { user } = await renderApp(`/applications/${REVIEW.id}`);

    const latest = within(await screen.findByRole('listitem', { name: /82%/ }));
    await user.click(latest.getByRole('button', { name: /^Delete/ }));

    expect(await latest.findByRole('alert')).toHaveTextContent('Something went wrong on our side.');
    expect(latest.getByText('82% of what the Job asks for')).toBeVisible();
    expect(within(screen.getByRole('listitem', { name: /54%/ })).queryByRole('alert')).toBeNull();
  });

  it('names what it could not do when the server refuses without saying why', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...getsApplication(REVIEW),
      ...refusesMatchAssessmentDeletion([LATEST_ASSESSMENT], { ...SERVER_FAULT, detail: null }),
    );

    const { user } = await renderApp(`/applications/${REVIEW.id}`);

    const latest = within(await screen.findByRole('listitem', { name: /82%/ }));
    await user.click(latest.getByRole('button', { name: /^Delete/ }));

    expect(await latest.findByRole('alert')).toHaveTextContent(
      "That reading couldn't be deleted. It is still on record.",
    );
  });
});

describe('an Application review whose assessments will not load', () => {
  it('keeps the readings already on screen when an older page faults', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...getsApplication(REVIEW),
      ...failsToPageMatchAssessments([LATEST_ASSESSMENT], SERVER_FAULT),
    );

    const { user } = await renderApp(`/applications/${REVIEW.id}`);

    expect(await widget().findByText('82% of what the Job asks for')).toBeVisible();

    await user.click(widget().getByRole('button', { name: 'Show older assessments' }));

    await waitFor(() =>
      expect(widget().getByRole('alert')).toHaveTextContent('Something went wrong on our side.'),
    );
    expect(widget().getByText('82% of what the Job asks for')).toBeVisible();
    expect(screen.queryByText("Couldn't load this")).toBeNull();
  });

  it('takes down the widget and leaves the rest of the review standing', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    server.use(
      ...signedInAs(RECRUITER),
      ...getsApplication(REVIEW),
      ...failsToListMatchAssessments(SERVER_FAULT),
    );

    await renderApp(`/applications/${REVIEW.id}`);

    expect(await screen.findByText("Couldn't load this")).toBeVisible();
    expect(
      screen.getByText("Match assessment didn't load. The rest of the page is fine."),
    ).toBeVisible();
    expect(screen.getByRole('heading', { level: 1, name: 'Amal Haddad' })).toBeVisible();
    expect(screen.getByRole('region', { name: 'Pipeline' })).toBeVisible();
    expect(screen.getByRole('region', { name: 'Snapshot' })).toBeVisible();
  });
});
