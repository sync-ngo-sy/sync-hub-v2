import type { components } from '@sync/api-client';
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
import {
  listsMessageTemplates,
  managesMessageTemplates,
} from '@/features/templates/testing/handlers';
import { failsToReadTenant } from '@/features/tenant/testing/handlers';
import { RECRUITER, SERVER_FAULT } from '@/testing/fixtures';
import { renderApp } from '@/testing/render-app';
import { server } from '@/testing/server';

type OutgoingMessage = components['schemas']['OutgoingMessage'];

const REVIEW = AMAL_REVIEW;
const WIDGET = 'Message the applicant';
const TEMPLATES = [INTERVIEW_INVITATION, THANKS_BUT_NO];

const INVITATION = {
  subject: 'An interview for Field Coordinator?',
  body: 'Hi Amal Haddad,\n\nWe would like to talk to you about Field Coordinator.\n\nAman Relief',
};
const REJECTION = {
  subject: 'Your application for Field Coordinator',
  body: 'Hi Amal Haddad,\n\nWe are moving other applicants forward.\n\nAman Relief',
};

const FROM_THE_TEMPLATE =
  'The name here is the Snapshot’s. The send greets the candidate by the name on their profile today.';
const AS_EDITED = 'These words go exactly as they read here. The template keeps its own.';

function widget() {
  return within(screen.getByRole('region', { name: WIDGET }));
}

async function pick(user: { click: (element: Element) => Promise<void> }, name: string) {
  await user.click(await screen.findByLabelText('Message template'));
  await user.click(await screen.findByRole('option', { name }));
}

function subjectField() {
  return widget().getByLabelText('Subject');
}

function messageField() {
  return widget().getByLabelText('Message');
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

  it('shows nothing to write until a template is picked', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...getsApplication(REVIEW),
      ...listsMessageTemplates(TEMPLATES),
    );

    await renderApp(`/applications/${REVIEW.id}`);

    expect(await screen.findByRole('region', { name: WIDGET })).toBeVisible();
    expect(
      widget().getByText('Pick a template to read and edit it before you send it.'),
    ).toBeVisible();
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

describe('the draft a template opens', () => {
  it('reads as the candidate will read it, with every placeholder filled', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...getsApplication(REVIEW),
      ...listsMessageTemplates(TEMPLATES),
    );

    const { user } = await renderApp(`/applications/${REVIEW.id}`);
    await pick(user, 'Interview invitation');

    expect(await widget().findByLabelText('Subject')).toHaveValue(INVITATION.subject);
    expect(messageField()).toHaveValue(INVITATION.body);
  });

  it('admits the greeting comes from the Snapshot, not the profile the send will read', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...getsApplication(REVIEW),
      ...listsMessageTemplates(TEMPLATES),
    );

    const { user } = await renderApp(`/applications/${REVIEW.id}`);
    await pick(user, 'Interview invitation');

    expect(await widget().findByText(FROM_THE_TEMPLATE)).toBeVisible();
  });

  it('re-reads the draft when a different template is picked', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...getsApplication(REVIEW),
      ...listsMessageTemplates(TEMPLATES),
    );

    const { user } = await renderApp(`/applications/${REVIEW.id}`);
    await pick(user, 'Interview invitation');
    expect(await widget().findByLabelText('Subject')).toHaveValue(INVITATION.subject);

    await pick(user, 'Thanks, but not this time');

    await waitFor(() => expect(subjectField()).toHaveValue(REJECTION.subject));
    expect(messageField()).toHaveValue(REJECTION.body);
  });
});

describe('editing the draft before it goes', () => {
  it('sends the edited words rather than the template’s', async () => {
    const asked: OutgoingMessage[] = [];
    server.use(
      ...signedInAs(RECRUITER),
      ...getsApplication(REVIEW),
      ...listsMessageTemplates(TEMPLATES),
      ...messagesApplicant(QUEUED_MESSAGE, asked),
    );

    const { user } = await renderApp(`/applications/${REVIEW.id}`);
    await pick(user, 'Interview invitation');
    await user.clear(await widget().findByLabelText('Subject'));
    await user.type(subjectField(), 'Could we meet on Tuesday?');
    await user.type(messageField(), ' Ten in the morning suits us.');

    await user.click(widget().getByRole('button', { name: 'Send this message' }));

    expect(
      await screen.findByText('Message queued — the candidate will have it shortly.'),
    ).toBeVisible();
    await waitFor(() =>
      expect(asked).toEqual([
        {
          template_id: INTERVIEW_INVITATION.id,
          edited: {
            subject: 'Could we meet on Tuesday?',
            body: `${INVITATION.body} Ten in the morning suits us.`,
          },
        },
      ]),
    );
  });

  it('says the edited words go exactly as they read', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...getsApplication(REVIEW),
      ...listsMessageTemplates(TEMPLATES),
    );

    const { user } = await renderApp(`/applications/${REVIEW.id}`);
    await pick(user, 'Interview invitation');
    await user.type(await widget().findByLabelText('Subject'), ' Tuesday?');

    expect(await widget().findByText(AS_EDITED)).toBeVisible();
    expect(widget().queryByText(FROM_THE_TEMPLATE)).toBeNull();
  });

  it('leaves the saved template as it was, however many edited sends go', async () => {
    const onRevise = vi.fn();
    const onCreate = vi.fn();
    server.use(
      ...signedInAs(RECRUITER),
      ...getsApplication(REVIEW),
      ...managesMessageTemplates(TEMPLATES, { onRevise, onCreate }),
      ...messagesApplicant(QUEUED_MESSAGE),
    );

    const { user } = await renderApp(`/applications/${REVIEW.id}`);
    for (const words of ['First rewrite.', 'Second rewrite.']) {
      await pick(user, 'Interview invitation');
      await user.clear(await widget().findByLabelText('Subject'));
      await user.type(subjectField(), words);
      await user.click(widget().getByRole('button', { name: 'Send this message' }));
      await waitFor(() =>
        expect(
          widget().getByText('Pick a template to read and edit it before you send it.'),
        ).toBeVisible(),
      );
    }

    await pick(user, 'Interview invitation');

    expect(await widget().findByLabelText('Subject')).toHaveValue(INVITATION.subject);
    expect(messageField()).toHaveValue(INVITATION.body);
    expect(onRevise).not.toHaveBeenCalled();
    expect(onCreate).not.toHaveBeenCalled();
  });

  it('throws an edit away when another template is picked', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...getsApplication(REVIEW),
      ...listsMessageTemplates(TEMPLATES),
    );

    const { user } = await renderApp(`/applications/${REVIEW.id}`);
    await pick(user, 'Interview invitation');
    await user.type(await widget().findByLabelText('Subject'), ' Tuesday?');
    await pick(user, 'Thanks, but not this time');

    await waitFor(() => expect(subjectField()).toHaveValue(REJECTION.subject));
    expect(widget().getByText(FROM_THE_TEMPLATE)).toBeVisible();
  });

  it('refuses a placeholder no message can fill, without asking the API', async () => {
    const asked: OutgoingMessage[] = [];
    server.use(
      ...signedInAs(RECRUITER),
      ...getsApplication(REVIEW),
      ...listsMessageTemplates(TEMPLATES),
      ...messagesApplicant(QUEUED_MESSAGE, asked),
    );

    const { user } = await renderApp(`/applications/${REVIEW.id}`);
    await pick(user, 'Interview invitation');
    await user.type(await widget().findByLabelText('Subject'), ' {{{{ salary }}');

    await user.click(widget().getByRole('button', { name: 'Send this message' }));

    expect(
      await widget().findByText(
        'Nothing can fill {{ salary }}. Use {{ candidate_name }}, {{ job_title }} or {{ tenant_name }}.',
      ),
    ).toBeVisible();
    expect(asked).toEqual([]);
  });

  it('refuses an emptied draft, and says so beside each field', async () => {
    const asked: OutgoingMessage[] = [];
    server.use(
      ...signedInAs(RECRUITER),
      ...getsApplication(REVIEW),
      ...listsMessageTemplates(TEMPLATES),
      ...messagesApplicant(QUEUED_MESSAGE, asked),
    );

    const { user } = await renderApp(`/applications/${REVIEW.id}`);
    await pick(user, 'Interview invitation');
    await user.clear(await widget().findByLabelText('Subject'));
    await user.clear(messageField());

    await user.click(widget().getByRole('button', { name: 'Send this message' }));

    expect(await widget().findByText('Write a subject line.')).toBeVisible();
    expect(widget().getByText('Write the message.')).toBeVisible();
    expect(asked).toEqual([]);
  });
});

describe('sending a message to an applicant', () => {
  it('sends the picked template and confirms the send as an outcome', async () => {
    const asked: OutgoingMessage[] = [];
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
    await waitFor(() =>
      expect(asked).toEqual([{ template_id: INTERVIEW_INVITATION.id, edited: null }]),
    );
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
      expect(
        widget().getByText('Pick a template to read and edit it before you send it.'),
      ).toBeVisible(),
    );
    expect(widget().queryByRole('button', { name: 'Send this message' })).toBeNull();
  });

  it('puts a refused send beside the button, and keeps the draft to try again', async () => {
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
    expect(subjectField()).toHaveValue(INVITATION.subject);
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
