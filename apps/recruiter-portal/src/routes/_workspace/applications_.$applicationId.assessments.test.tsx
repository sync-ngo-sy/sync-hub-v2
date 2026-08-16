import { screen, within } from '@testing-library/react';
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
  failsToReadMatchAssessment,
  getsApplication,
  holdsMatchAssessment,
  readsMatchAssessment,
} from '@/features/applications/testing/handlers';
import { signedInAs } from '@/features/auth/testing/handlers';
import { absoluteDateTime } from '@/lib/dates';
import { RECRUITER, SERVER_FAULT } from '@/testing/fixtures';
import { renderApp } from '@/testing/render-app';
import { server } from '@/testing/server';

const REVIEW = AMAL_REVIEW;
const WIDGET = 'Match assessment';

const ASK = 'Ask for a new reading';
const ASK_FIRST = 'Ask for a reading';

function widget() {
  return within(screen.getByRole('region', { name: WIDGET }));
}

describe('the reading an Application carries', () => {
  it('gives the reading its explanation, its strengths and its gaps', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...getsApplication(REVIEW),
      ...readsMatchAssessment(LATEST_ASSESSMENT),
    );

    await renderApp(`/applications/${REVIEW.id}`);

    expect(await widget().findByText('82% of what the Job asks for')).toBeVisible();
    expect(widget().getByText(LATEST_ASSESSMENT.explanation as string)).toBeVisible();
    expect(widget().getByText('Nine years of field logistics')).toBeVisible();
    expect(widget().getByText('No formal procurement training')).toBeVisible();
  });

  it('stamps the reading with when it was written and what wrote it', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...getsApplication(REVIEW),
      ...readsMatchAssessment(LATEST_ASSESSMENT),
    );

    await renderApp(`/applications/${REVIEW.id}`);

    expect(
      await widget().findByText(absoluteDateTime(LATEST_ASSESSMENT.assessed_at)),
    ).toBeVisible();
    expect(widget().getByText('claude-sonnet-5 · prompt v3')).toBeVisible();
  });

  it('says a reading was made again rather than showing one date for two readings', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...getsApplication(REVIEW),
      ...readsMatchAssessment(EARLIER_ASSESSMENT),
    );

    await renderApp(`/applications/${REVIEW.id}`);

    expect(await widget().findByText(/^Read again /)).toBeVisible();
  });

  it('renders a reading that gave a number and nothing else, rather than empty headings', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...getsApplication(REVIEW),
      ...readsMatchAssessment(BARE_ASSESSMENT),
    );

    await renderApp(`/applications/${REVIEW.id}`);

    expect(await widget().findByText('40% of what the Job asks for')).toBeVisible();
    expect(widget().getByText('The model gave no reasons for this reading.')).toBeVisible();
    expect(widget().queryByText('Strengths')).toBeNull();
    expect(widget().queryByText('Gaps')).toBeNull();
  });

  it('says an Application has not been read yet rather than showing nothing', async () => {
    server.use(...signedInAs(RECRUITER), ...getsApplication(REVIEW), ...readsMatchAssessment(null));

    await renderApp(`/applications/${REVIEW.id}`);

    expect(
      await widget().findByText(/No AI has read this Application against the Job yet/),
    ).toBeVisible();
    expect(widget().getByRole('button', { name: ASK_FIRST })).toBeEnabled();
  });

  it('offers no way to throw the reading away', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...getsApplication(REVIEW),
      ...readsMatchAssessment(LATEST_ASSESSMENT),
    );

    await renderApp(`/applications/${REVIEW.id}`);

    expect(await widget().findByText('82% of what the Job asks for')).toBeVisible();
    expect(widget().queryByRole('button', { name: /Delete/ })).toBeNull();
    expect(widget().getAllByRole('button')).toHaveLength(1);
  });
});

describe('asking for a new reading', () => {
  it('replaces the reading on screen rather than adding one beside it', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...getsApplication(REVIEW),
      ...assessesMatch(EARLIER_ASSESSMENT, LATEST_ASSESSMENT),
    );

    const { user } = await renderApp(`/applications/${REVIEW.id}`);
    expect(await widget().findByText('54% of what the Job asks for')).toBeVisible();

    await user.click(widget().getByRole('button', { name: ASK }));

    expect(await widget().findByText('82% of what the Job asks for')).toBeVisible();
    expect(widget().queryByText('54% of what the Job asks for')).toBeNull();
  });

  it('says the model is working while it waits, and asks for nothing twice', async () => {
    const held = holdsMatchAssessment(null, LATEST_ASSESSMENT);
    server.use(...signedInAs(RECRUITER), ...getsApplication(REVIEW), ...held.handlers);

    const { user } = await renderApp(`/applications/${REVIEW.id}`);

    await user.click(await screen.findByRole('button', { name: ASK_FIRST }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      'The model is reading the Snapshot against the Job.',
    );
    expect(widget().getByRole('button', { name: 'Reading the Application…' })).toBeDisabled();

    held.arrive();

    expect(await widget().findByText('82% of what the Job asks for')).toBeVisible();
    expect(widget().getByRole('button', { name: ASK })).toBeEnabled();
  });

  it('does not claim the Application has never been read while it is being read', async () => {
    const held = holdsMatchAssessment(null, LATEST_ASSESSMENT);
    server.use(...signedInAs(RECRUITER), ...getsApplication(REVIEW), ...held.handlers);

    const { user } = await renderApp(`/applications/${REVIEW.id}`);

    await user.click(await screen.findByRole('button', { name: ASK_FIRST }));

    expect(await screen.findByRole('status')).toBeVisible();
    expect(widget().queryByText(/No AI has read this Application/)).toBeNull();

    held.arrive();
    expect(await widget().findByText('82% of what the Job asks for')).toBeVisible();
  });

  it.each([
    ['a tenant that has asked too often', TOO_MANY_ASSESSMENTS, 429 as const],
    ['a model that could not read it', MODEL_COULD_NOT_ASSESS, 502 as const],
    ['a deployment with no model at all', NO_ASSESSMENT_MODEL, 503 as const],
  ])(
    'puts the reason beside the button for %s, and keeps the reading',
    async (_case, problem, status) => {
      server.use(
        ...signedInAs(RECRUITER),
        ...getsApplication(REVIEW),
        ...failsToAssessMatch(EARLIER_ASSESSMENT, problem, status),
      );

      const { user } = await renderApp(`/applications/${REVIEW.id}`);

      await user.click(await screen.findByRole('button', { name: ASK }));

      expect(await widget().findByRole('alert')).toHaveTextContent(problem.detail as string);
      expect(screen.getByRole('heading', { level: 1, name: 'Amal Haddad' })).toBeVisible();
      expect(widget().getByText('54% of what the Job asks for')).toBeVisible();
    },
  );

  it('names what it could not do when the server refuses without saying why', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...getsApplication(REVIEW),
      ...failsToAssessMatch(null, { ...MODEL_COULD_NOT_ASSESS, detail: null }, 502),
    );

    const { user } = await renderApp(`/applications/${REVIEW.id}`);

    await user.click(await screen.findByRole('button', { name: ASK_FIRST }));

    const alert = await widget().findByRole('alert');
    expect(alert).toHaveTextContent(
      "This Application couldn't be read again. Nothing was changed.",
    );
    expect(alert).not.toHaveTextContent('Bad Gateway');
  });

  it('drops the refusal once a reading comes back', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...getsApplication(REVIEW),
      ...failsToAssessMatch(null, TOO_MANY_ASSESSMENTS, 429),
    );

    const { user } = await renderApp(`/applications/${REVIEW.id}`);

    await user.click(await screen.findByRole('button', { name: ASK_FIRST }));
    expect(await widget().findByRole('alert')).toBeVisible();

    server.use(...assessesMatch(null, LATEST_ASSESSMENT));
    await user.click(widget().getByRole('button', { name: ASK_FIRST }));

    expect(await widget().findByText('82% of what the Job asks for')).toBeVisible();
    expect(widget().queryByRole('alert')).toBeNull();
  });

  it('takes down the widget and leaves the rest of the review standing', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    server.use(
      ...signedInAs(RECRUITER),
      ...getsApplication(REVIEW),
      ...failsToReadMatchAssessment(SERVER_FAULT),
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
