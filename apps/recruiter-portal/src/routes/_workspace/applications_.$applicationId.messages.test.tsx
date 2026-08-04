import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  AMAL_REVIEW,
  NO_SUCH_TEMPLATE_TO_SEND,
  QUEUED_MESSAGE,
} from '@/features/applications/testing/fixtures';
import {
  getsApplication,
  holdsMessage,
  messagesApplicant,
  refusesMessage,
} from '@/features/applications/testing/handlers';
import { signedInAs } from '@/features/auth/testing/handlers';
import { INTERVIEW_INVITATION, THANKS_BUT_NO } from '@/features/templates/testing/fixtures';
import { listsMessageTemplates } from '@/features/templates/testing/handlers';
import { failsToReadTenant } from '@/features/tenant/testing/handlers';
import { RECRUITER, SERVER_FAULT } from '@/testing/fixtures';
import { renderApp } from '@/testing/render-app';
import { server } from '@/testing/server';

const REVIEW = AMAL_REVIEW;
const WIDGET = 'Message the applicant';
const TEMPLATES = [INTERVIEW_INVITATION, THANKS_BUT_NO];

function widget() {
  return within(screen.getByRole('region', { name: WIDGET }));
}

async function pick(user: { click: (element: Element) => Promise<void> }, name: string) {
  await user.click(await screen.findByLabelText('Message template'));
  await user.click(await screen.findByRole('option', { name }));
}

describe('choosing the words to write an applicant', () => {
  it('offers every Message template the Tenant has saved', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...getsApplication(REVIEW),
      ...listsMessageTemplates(TEMPLATES),
    );

    const { user } = await renderApp(`/applications/${REVIEW.id}`);

    await user.click(await screen.findByLabelText('Message template'));

    const offered = await screen.findAllByRole('option');
    expect(offered.map((option) => option.textContent)).toEqual([
      'Interview invitation',
      'Thanks, but not this time',
    ]);
  });

  it('shows nothing to preview until a template is picked', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...getsApplication(REVIEW),
      ...listsMessageTemplates(TEMPLATES),
    );

    await renderApp(`/applications/${REVIEW.id}`);

    expect(await screen.findByRole('region', { name: WIDGET })).toBeVisible();
    expect(widget().getByText('Pick a template to read it before you send it.')).toBeVisible();
    expect(widget().queryByRole('button', { name: 'Send this message' })).toBeNull();
  });

  it('sends a Recruiter to write a template when the Tenant has none', async () => {
    server.use(...signedInAs(RECRUITER), ...getsApplication(REVIEW), ...listsMessageTemplates([]));

    await renderApp(`/applications/${REVIEW.id}`);

    expect(await screen.findByRole('region', { name: WIDGET })).toBeVisible();
    expect(
      widget().getByText('This Tenant has no Message template to send from yet.'),
    ).toBeVisible();
    expect(widget().getByRole('link', { name: 'Write a Message template' })).toHaveAttribute(
      'href',
      '/templates',
    );
  });
});

describe('the preview of a message before it goes', () => {
  it('reads as the candidate will read it, with every placeholder filled', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...getsApplication(REVIEW),
      ...listsMessageTemplates(TEMPLATES),
    );

    const { user } = await renderApp(`/applications/${REVIEW.id}`);
    await pick(user, 'Interview invitation');

    const preview = within(await screen.findByRole('article', { name: 'Message preview' }));
    expect(preview.getByText('An interview for Field Coordinator?')).toBeVisible();
    expect(
      preview.getByText(
        'Hi Amal Haddad, We would like to talk to you about Field Coordinator. Aman Relief',
      ),
    ).toBeVisible();
    expect(preview.queryByText(/\{\{/)).toBeNull();
  });

  it('admits the greeting comes from the Snapshot, not the profile the send will read', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...getsApplication(REVIEW),
      ...listsMessageTemplates(TEMPLATES),
    );

    const { user } = await renderApp(`/applications/${REVIEW.id}`);
    await pick(user, 'Interview invitation');

    expect(await screen.findByRole('article', { name: 'Message preview' })).toBeVisible();
    expect(
      widget().getByText(
        'The name here is the Snapshot’s. The send greets the candidate by the name on their profile today.',
      ),
    ).toBeVisible();
  });

  it('re-reads the preview when a different template is picked', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...getsApplication(REVIEW),
      ...listsMessageTemplates(TEMPLATES),
    );

    const { user } = await renderApp(`/applications/${REVIEW.id}`);
    await pick(user, 'Interview invitation');
    expect(await screen.findByText('An interview for Field Coordinator?')).toBeVisible();

    await pick(user, 'Thanks, but not this time');

    const preview = within(await screen.findByRole('article', { name: 'Message preview' }));
    expect(preview.getByText('Your application for Field Coordinator')).toBeVisible();
    expect(preview.getByText(/We are moving other applicants forward\./)).toBeVisible();
    expect(preview.queryByText('An interview for Field Coordinator?')).toBeNull();
  });
});

describe('sending a message to an applicant', () => {
  it('sends the picked template and confirms the send as an outcome', async () => {
    const asked: string[] = [];
    server.use(
      ...signedInAs(RECRUITER),
      ...getsApplication(REVIEW),
      ...listsMessageTemplates(TEMPLATES),
      ...messagesApplicant(QUEUED_MESSAGE, asked),
    );

    const { user } = await renderApp(`/applications/${REVIEW.id}`);
    await pick(user, 'Interview invitation');

    await user.click(await widget().findByRole('button', { name: 'Send this message' }));

    expect(
      await screen.findByText('Message queued — the candidate will have it shortly.'),
    ).toBeVisible();
    await waitFor(() => expect(asked).toEqual([INTERVIEW_INVITATION.id]));
  });

  it('says the message is going while it goes, and sends it only once', async () => {
    const held = holdsMessage(QUEUED_MESSAGE);
    server.use(
      ...signedInAs(RECRUITER),
      ...getsApplication(REVIEW),
      ...listsMessageTemplates(TEMPLATES),
      ...held.handlers,
    );

    const { user } = await renderApp(`/applications/${REVIEW.id}`);
    await pick(user, 'Interview invitation');

    await user.click(await widget().findByRole('button', { name: 'Send this message' }));

    expect(await widget().findByRole('button', { name: 'Sending…' })).toBeDisabled();

    held.arrive();

    expect(
      await screen.findByText('Message queued — the candidate will have it shortly.'),
    ).toBeVisible();
  });

  it('clears the picker after a send, so the same words do not go twice by accident', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...getsApplication(REVIEW),
      ...listsMessageTemplates(TEMPLATES),
      ...messagesApplicant(QUEUED_MESSAGE),
    );

    const { user } = await renderApp(`/applications/${REVIEW.id}`);
    await pick(user, 'Interview invitation');
    await user.click(await widget().findByRole('button', { name: 'Send this message' }));

    expect(
      await screen.findByText('Message queued — the candidate will have it shortly.'),
    ).toBeVisible();
    await waitFor(() =>
      expect(widget().getByText('Pick a template to read it before you send it.')).toBeVisible(),
    );
    expect(widget().queryByRole('button', { name: 'Send this message' })).toBeNull();
  });

  it('puts a refused send beside the button, and keeps the preview to try again', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...getsApplication(REVIEW),
      ...listsMessageTemplates(TEMPLATES),
      ...refusesMessage(NO_SUCH_TEMPLATE_TO_SEND, 404),
    );

    const { user } = await renderApp(`/applications/${REVIEW.id}`);
    await pick(user, 'Interview invitation');
    await user.click(await widget().findByRole('button', { name: 'Send this message' }));

    expect(await widget().findByRole('alert')).toHaveTextContent(
      'This tenant has no message template with that id.',
    );
    expect(widget().getByRole('button', { name: 'Send this message' })).toBeEnabled();
    expect(screen.getByRole('heading', { level: 1, name: 'Amal Haddad' })).toBeVisible();
    expect(screen.getByRole('region', { name: 'Pipeline' })).toBeVisible();
  });

  it('says what went wrong in its own words when the server refuses without saying why', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...getsApplication(REVIEW),
      ...listsMessageTemplates(TEMPLATES),
      ...refusesMessage({ ...SERVER_FAULT, detail: null }, 500),
    );

    const { user } = await renderApp(`/applications/${REVIEW.id}`);
    await pick(user, 'Interview invitation');
    await user.click(await widget().findByRole('button', { name: 'Send this message' }));

    const alert = await widget().findByRole('alert');
    expect(alert).toHaveTextContent('This message was not sent. Nothing reached the candidate.');
    expect(alert).not.toHaveTextContent('Internal Server Error');
  });
});

describe('an Application review whose outreach will not load', () => {
  it('takes down the widget and leaves the rest of the review standing', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    server.use(
      ...signedInAs(RECRUITER),
      ...getsApplication(REVIEW),
      ...failsToReadTenant(SERVER_FAULT),
    );

    await renderApp(`/applications/${REVIEW.id}`);

    expect(await screen.findByText("Couldn't load this")).toBeVisible();
    expect(
      screen.getByText("Message the applicant didn't load. The rest of the page is fine."),
    ).toBeVisible();
    expect(screen.getByRole('heading', { level: 1, name: 'Amal Haddad' })).toBeVisible();
    expect(screen.getByRole('region', { name: 'Pipeline' })).toBeVisible();
    expect(screen.getByRole('region', { name: 'Match assessment' })).toBeVisible();
  });
});
