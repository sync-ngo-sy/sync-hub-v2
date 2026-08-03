import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { signedInAs } from '@/features/auth/testing/handlers';
import { INTERVIEW_INVITATION, THANKS_BUT_NO } from '@/features/templates/testing/fixtures';
import {
  alreadyDeletedElsewhere,
  failsToDeleteMessageTemplate,
  getsMessageTemplate,
  listsMessageTemplates,
  managesMessageTemplates,
  refusesMessageTemplateRevision,
  refusesTakenNameOnRevision,
} from '@/features/templates/testing/handlers';
import { RECRUITER } from '@/testing/fixtures';
import { renderApp } from '@/testing/render-app';
import { server } from '@/testing/server';

describe('Message templates', () => {
  it('invites the first template when the Tenant has none', async () => {
    server.use(...signedInAs(RECRUITER), ...listsMessageTemplates([]));

    await renderApp('/templates');

    expect(await screen.findByRole('heading', { level: 1, name: 'Templates' })).toBeVisible();
    expect(
      screen.getByText(
        'No Message templates yet — write the first one your Recruiters will reuse.',
      ),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Create your first template' })).toBeVisible();
  });

  it('writes the first template and lists it', async () => {
    const onCreate = vi.fn();
    server.use(...signedInAs(RECRUITER), ...managesMessageTemplates([], { onCreate }));

    const { user } = await renderApp('/templates');
    await user.click(await screen.findByRole('button', { name: 'Create your first template' }));
    await user.type(screen.getByLabelText('Name'), 'Interview invitation');
    await user.type(screen.getByLabelText('Subject'), 'An interview for {{{{ job_title }}?');
    await user.type(
      screen.getByLabelText('Message'),
      'Hi {{{{ candidate_name }}, come and talk to us.',
    );
    await user.click(screen.getByRole('button', { name: 'Save template' }));

    await waitFor(() =>
      expect(onCreate).toHaveBeenCalledExactlyOnceWith({
        name: 'Interview invitation',
        subject: 'An interview for {{ job_title }}?',
        body: 'Hi {{ candidate_name }}, come and talk to us.',
      }),
    );
    expect(await screen.findByText('Template saved')).toBeVisible();
    expect(await screen.findByText('Interview invitation')).toBeVisible();
    expect(screen.getByText('An interview for {{ job_title }}?')).toBeVisible();
  });

  it('opens a template whole to revise it, and saves all of it', async () => {
    const onRevise = vi.fn();
    server.use(
      ...signedInAs(RECRUITER),
      ...managesMessageTemplates([INTERVIEW_INVITATION], { onRevise }),
    );

    const { user } = await renderApp('/templates');
    await user.click(
      await screen.findByRole('button', { name: 'Actions for Interview invitation' }),
    );
    await user.click(await screen.findByRole('menuitem', { name: 'Edit template' }));

    expect(await screen.findByLabelText('Name')).toHaveValue('Interview invitation');
    expect(screen.getByLabelText('Subject')).toHaveValue('An interview for {{ job_title }}?');
    expect(screen.getByLabelText('Message')).toHaveValue(INTERVIEW_INVITATION.body);

    const subject = screen.getByLabelText('Subject');
    await user.clear(subject);
    await user.type(subject, 'Can we talk about {{{{ job_title }}?');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() =>
      expect(onRevise).toHaveBeenCalledExactlyOnceWith({
        name: 'Interview invitation',
        subject: 'Can we talk about {{ job_title }}?',
        body: INTERVIEW_INVITATION.body,
      }),
    );
    expect(await screen.findByText('Template updated')).toBeVisible();
    expect(await screen.findByText('Can we talk about {{ job_title }}?')).toBeVisible();
  });

  it('opens the template as the server has it now, not as the list saw it', async () => {
    const stale = { ...INTERVIEW_INVITATION, subject: 'An older subject' };
    server.use(
      ...signedInAs(RECRUITER),
      ...listsMessageTemplates([stale]),
      ...getsMessageTemplate(INTERVIEW_INVITATION),
    );

    const { user } = await renderApp('/templates');
    await user.click(
      await screen.findByRole('button', { name: 'Actions for Interview invitation' }),
    );
    await user.click(await screen.findByRole('menuitem', { name: 'Edit template' }));

    expect(await screen.findByLabelText('Subject')).toHaveValue(
      'An interview for {{ job_title }}?',
    );
  });

  it('confirms before deleting, and leaves the shelf alone if the recruiter backs out', async () => {
    const onDelete = vi.fn();
    server.use(
      ...signedInAs(RECRUITER),
      ...managesMessageTemplates([INTERVIEW_INVITATION, THANKS_BUT_NO], { onDelete }),
    );

    const { user } = await renderApp('/templates');
    await user.click(
      await screen.findByRole('button', { name: 'Actions for Interview invitation' }),
    );
    await user.click(await screen.findByRole('menuitem', { name: 'Delete template' }));

    const asking = await screen.findByRole('alertdialog');
    expect(asking).toHaveTextContent('Delete “Interview invitation”?');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.getByText('Interview invitation')).toBeVisible();
  });

  it('deletes a template once confirmed, and drops it from the list', async () => {
    const onDelete = vi.fn();
    server.use(
      ...signedInAs(RECRUITER),
      ...managesMessageTemplates([INTERVIEW_INVITATION, THANKS_BUT_NO], { onDelete }),
    );

    const { user } = await renderApp('/templates');
    await user.click(
      await screen.findByRole('button', { name: 'Actions for Interview invitation' }),
    );
    await user.click(await screen.findByRole('menuitem', { name: 'Delete template' }));
    await user.click(await screen.findByRole('button', { name: 'Delete template' }));

    await waitFor(() => expect(onDelete).toHaveBeenCalledExactlyOnceWith(INTERVIEW_INVITATION.id));
    expect(await screen.findByText('Template deleted')).toBeVisible();
    await waitFor(() => expect(screen.queryByText('Interview invitation')).not.toBeInTheDocument());
    expect(screen.getByText('Thanks, but not this time')).toBeVisible();
  });

  it('takes a template a teammate already deleted as deleted, not as a failure', async () => {
    server.use(...signedInAs(RECRUITER), ...alreadyDeletedElsewhere(INTERVIEW_INVITATION));

    const { user } = await renderApp('/templates');
    await user.click(
      await screen.findByRole('button', { name: 'Actions for Interview invitation' }),
    );
    await user.click(await screen.findByRole('menuitem', { name: 'Delete template' }));
    await user.click(await screen.findByRole('button', { name: 'Delete template' }));

    expect(await screen.findByText('Template deleted')).toBeVisible();
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    await waitFor(() => expect(screen.queryByText('Interview invitation')).not.toBeInTheDocument());
  });

  it('keeps the list and the confirmation when a delete actually fails', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...listsMessageTemplates([INTERVIEW_INVITATION]),
      ...failsToDeleteMessageTemplate({
        type: 'urn:sync:problem:internal-error',
        title: 'Internal Server Error',
        status: 500,
        detail: 'Something went wrong on our side.',
      }),
    );

    const { user } = await renderApp('/templates');
    await user.click(
      await screen.findByRole('button', { name: 'Actions for Interview invitation' }),
    );
    await user.click(await screen.findByRole('menuitem', { name: 'Delete template' }));
    await user.click(await screen.findByRole('button', { name: 'Delete template' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong on our side.');
    expect(screen.getByRole('alertdialog')).toBeVisible();
    expect(screen.getByText('Interview invitation')).toBeVisible();
  });

  it('validates beside the fields before anything is sent', async () => {
    const onCreate = vi.fn();
    server.use(...signedInAs(RECRUITER), ...managesMessageTemplates([], { onCreate }));

    const { user } = await renderApp('/templates');
    await user.click(await screen.findByRole('button', { name: 'Create your first template' }));
    await user.click(screen.getByRole('button', { name: 'Save template' }));

    expect(await screen.findByText('Name this template.')).toBeVisible();
    expect(screen.getByText('Write a subject line.')).toBeVisible();
    expect(screen.getByText('Write the message.')).toBeVisible();
    expect(onCreate).not.toHaveBeenCalled();
  });

  it('refuses a placeholder no message can fill without asking the API', async () => {
    const onCreate = vi.fn();
    server.use(...signedInAs(RECRUITER), ...managesMessageTemplates([], { onCreate }));

    const { user } = await renderApp('/templates');
    await user.click(await screen.findByRole('button', { name: 'Create your first template' }));
    await user.type(screen.getByLabelText('Name'), 'Interview invitation');
    await user.type(screen.getByLabelText('Subject'), 'An interview at {{{{ company }}?');
    await user.type(screen.getByLabelText('Message'), 'Come and talk to us.');
    await user.click(screen.getByRole('button', { name: 'Save template' }));

    expect(
      await screen.findByText(
        'Nothing can fill {{ company }}. Use {{ candidate_name }}, {{ job_title }} or {{ tenant_name }}.',
      ),
    ).toBeVisible();
    expect(onCreate).not.toHaveBeenCalled();
  });

  it('puts a name the Tenant has already used beneath the name field', async () => {
    server.use(...signedInAs(RECRUITER), ...managesMessageTemplates([INTERVIEW_INVITATION]));

    const { user } = await renderApp('/templates');
    await user.click(await screen.findByRole('button', { name: 'Create template' }));
    await user.type(screen.getByLabelText('Name'), 'Interview invitation');
    await user.type(screen.getByLabelText('Subject'), 'Another subject');
    await user.type(screen.getByLabelText('Message'), 'Another message.');
    await user.click(screen.getByRole('button', { name: 'Save template' }));

    expect(
      await screen.findByText(
        'This tenant already has a message template called “Interview invitation”.',
      ),
    ).toBeVisible();
    expect(screen.getByRole('dialog')).toBeVisible();
  });

  it('puts a rejected revision beneath the field the API names', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...listsMessageTemplates([INTERVIEW_INVITATION]),
      ...getsMessageTemplate(INTERVIEW_INVITATION),
      ...refusesMessageTemplateRevision({
        type: 'urn:sync:problem:validation-error',
        title: 'Unprocessable Entity',
        status: 422,
        detail: 'The request body is invalid.',
        errors: [
          {
            location: 'body.body',
            message: 'Value error, String should have at most 5000 characters',
            type: 'value_error',
          },
        ],
      }),
    );

    const { user } = await renderApp('/templates');
    await user.click(
      await screen.findByRole('button', { name: 'Actions for Interview invitation' }),
    );
    await user.click(await screen.findByRole('menuitem', { name: 'Edit template' }));
    await user.click(await screen.findByRole('button', { name: 'Save changes' }));

    expect(
      await screen.findByText('Value error, String should have at most 5000 characters'),
    ).toBeVisible();
  });

  it('puts a name taken by another template beneath the name field when revising too', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...listsMessageTemplates([INTERVIEW_INVITATION, THANKS_BUT_NO]),
      ...getsMessageTemplate(INTERVIEW_INVITATION),
      ...refusesTakenNameOnRevision('Thanks, but not this time'),
    );

    const { user } = await renderApp('/templates');
    await user.click(
      await screen.findByRole('button', { name: 'Actions for Interview invitation' }),
    );
    await user.click(await screen.findByRole('menuitem', { name: 'Edit template' }));
    const name = await screen.findByLabelText('Name');
    await user.clear(name);
    await user.type(name, 'Thanks, but not this time');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(
      await screen.findByText(
        'This tenant already has a message template called “Thanks, but not this time”.',
      ),
    ).toBeVisible();
    expect(screen.getByRole('dialog')).toBeVisible();
  });
});
