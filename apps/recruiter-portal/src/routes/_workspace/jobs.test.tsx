import type { components } from '@sync/api-client';
import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { signedInAs } from '@/features/auth/testing/handlers';
import {
  FIELD_COORDINATOR,
  FIELD_COORDINATOR_VIEW,
  PROGRAMME_OFFICER,
  PROGRAMME_OFFICER_VIEW,
} from '@/features/jobs/testing/fixtures';
import {
  changesJob,
  createsJob,
  getsJob,
  listsJobs,
  managesJobs,
  pagesJobs,
  refusesJobChange,
  refusesJobCreation,
  refusesJobEdit,
} from '@/features/jobs/testing/handlers';
import { RECRUITER } from '@/testing/fixtures';
import { renderApp } from '@/testing/render-app';
import { server } from '@/testing/server';

describe('Jobs', () => {
  it('keeps the status filter in the URL and sends it to the Jobs API', async () => {
    server.use(...signedInAs(RECRUITER), ...listsJobs([FIELD_COORDINATOR, PROGRAMME_OFFICER]));

    const { router, user } = await renderApp('/jobs?status=published');

    expect(screen.getByRole('tab', { name: 'Published' })).toHaveAttribute('data-active');
    expect(await screen.findByText('Field Coordinator')).toBeVisible();
    expect(screen.queryByText('Programme Officer')).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Draft' }));

    await waitFor(() => expect(router.state.location.search).toEqual({ status: 'draft' }));
    expect(await screen.findByText('Programme Officer')).toBeVisible();
    expect(screen.queryByText('Field Coordinator')).not.toBeInTheDocument();
  });

  it('loads the next cursor page on demand', async () => {
    server.use(...signedInAs(RECRUITER), ...pagesJobs([[FIELD_COORDINATOR], [PROGRAMME_OFFICER]]));

    const { user } = await renderApp('/jobs');
    expect(await screen.findByText('Field Coordinator')).toBeVisible();
    expect(screen.queryByText('Programme Officer')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Load more' }));

    expect(await screen.findByText('Programme Officer')).toBeVisible();
    expect(screen.getByText('2 shown')).toBeVisible();
  });

  it('validates a new draft beside the fields before sending it', async () => {
    server.use(...signedInAs(RECRUITER), ...listsJobs([]));

    const { user } = await renderApp('/jobs');
    await user.click(screen.getByRole('button', { name: 'Create your first job' }));
    await user.click(screen.getByRole('button', { name: 'Save draft' }));

    expect(await screen.findByText('Enter a job title.')).toBeVisible();
    expect(screen.getByText('Enter a job description.')).toBeVisible();
  });

  it('creates a Job as a draft through the API', async () => {
    const onCreate = vi.fn();
    server.use(
      ...signedInAs(RECRUITER),
      ...listsJobs([]),
      ...createsJob(FIELD_COORDINATOR_VIEW, onCreate),
    );

    const { user } = await renderApp('/jobs');
    await user.click(screen.getByRole('button', { name: 'Create job' }));
    await user.type(screen.getByLabelText('Title'), 'Field Coordinator');
    await user.type(screen.getByLabelText('Description'), 'Coordinate field teams.');
    await user.type(screen.getByLabelText('Location'), 'Aleppo');
    await user.type(screen.getByLabelText('Employment type'), 'Full time');
    await user.click(screen.getByRole('button', { name: 'Save draft' }));

    await waitFor(() =>
      expect(onCreate).toHaveBeenCalledExactlyOnceWith({
        title: 'Field Coordinator',
        description: 'Coordinate field teams.',
        location: 'Aleppo',
        employment_type: 'Full time',
        expires_at: null,
      }),
    );
    expect(await screen.findByText('Draft saved')).toBeVisible();
  });

  it('puts a server rejection beneath the new Job field it names', async () => {
    const rejected: components['schemas']['ValidationProblemDetail'] = {
      type: 'urn:sync:problem:validation',
      title: 'Invalid request',
      status: 422,
      detail: 'One field needs attention.',
      errors: [
        {
          location: 'body.title',
          message: 'A Job with this title already exists.',
          type: 'value_error',
        },
      ],
    };
    server.use(...signedInAs(RECRUITER), ...listsJobs([]), ...refusesJobCreation(rejected));

    const { user } = await renderApp('/jobs');
    await user.click(screen.getByRole('button', { name: 'Create job' }));
    await user.type(screen.getByLabelText('Title'), 'Field Coordinator');
    await user.type(screen.getByLabelText('Description'), 'Coordinate field teams.');
    await user.click(screen.getByRole('button', { name: 'Save draft' }));

    expect(await screen.findByText('A Job with this title already exists.')).toBeVisible();
  });

  it('loads a Job and saves its edits through the API', async () => {
    const onChange = vi.fn();
    const changed = {
      ...FIELD_COORDINATOR_VIEW,
      description: 'Coordinate field teams and regional partners.',
    };
    server.use(
      ...signedInAs(RECRUITER),
      ...listsJobs([FIELD_COORDINATOR]),
      ...getsJob(FIELD_COORDINATOR_VIEW),
      ...changesJob(changed, onChange),
    );

    const { user } = await renderApp('/jobs');
    await user.click(await screen.findByRole('button', { name: 'Actions for Field Coordinator' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Edit job' }));
    const description = await screen.findByLabelText('Description');
    await user.clear(description);
    await user.type(description, 'Coordinate field teams and regional partners.');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() =>
      expect(onChange).toHaveBeenCalledExactlyOnceWith({
        title: 'Field Coordinator',
        description: 'Coordinate field teams and regional partners.',
        location: 'Aleppo',
        employment_type: 'Full time',
        expires_at: null,
      }),
    );
    expect(await screen.findByText('Job updated')).toBeVisible();

    await user.click(await screen.findByRole('button', { name: 'Actions for Field Coordinator' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Edit job' }));
    expect(await screen.findByLabelText('Description')).toHaveValue(
      'Coordinate field teams and regional partners.',
    );
  });

  it('validates edits locally before sending them', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...listsJobs([FIELD_COORDINATOR]),
      ...getsJob(FIELD_COORDINATOR_VIEW),
    );

    const { user } = await renderApp('/jobs');
    await user.click(await screen.findByRole('button', { name: 'Actions for Field Coordinator' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Edit job' }));
    await user.clear(await screen.findByLabelText('Title'));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('Enter a job title.')).toBeVisible();
  });

  it('puts a server rejection beneath the edited Job field it names', async () => {
    const rejected: components['schemas']['ValidationProblemDetail'] = {
      type: 'urn:sync:problem:validation',
      title: 'Invalid request',
      status: 422,
      errors: [
        {
          location: 'body.description',
          message: 'Remove private contact details from the description.',
          type: 'value_error',
        },
      ],
    };
    server.use(
      ...signedInAs(RECRUITER),
      ...listsJobs([FIELD_COORDINATOR]),
      ...getsJob(FIELD_COORDINATOR_VIEW),
      ...refusesJobEdit(rejected),
    );

    const { user } = await renderApp('/jobs');
    await user.click(await screen.findByRole('button', { name: 'Actions for Field Coordinator' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Edit job' }));
    await user.click(await screen.findByRole('button', { name: 'Save changes' }));

    expect(
      await screen.findByText('Remove private contact details from the description.'),
    ).toBeVisible();
  });

  it('moves a Job through named lifecycle actions', async () => {
    const onChange = vi.fn();
    server.use(...signedInAs(RECRUITER), ...managesJobs([PROGRAMME_OFFICER_VIEW], onChange));

    const { user } = await renderApp('/jobs');
    await user.click(await screen.findByRole('button', { name: 'Actions for Programme Officer' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Publish job' }));

    await waitFor(() => expect(onChange).toHaveBeenCalledExactlyOnceWith({ status: 'published' }));
    expect(await screen.findByText('Job published')).toBeVisible();

    await user.click(screen.getByRole('tab', { name: 'Published' }));
    expect(await screen.findByText('Programme Officer')).toBeVisible();
  });

  it('closes a published Job through its named action', async () => {
    const onChange = vi.fn();
    server.use(
      ...signedInAs(RECRUITER),
      ...listsJobs([FIELD_COORDINATOR]),
      ...changesJob({ ...FIELD_COORDINATOR_VIEW, status: 'closed' }, onChange),
    );

    const { user } = await renderApp('/jobs');
    await user.click(await screen.findByRole('button', { name: 'Actions for Field Coordinator' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Close job' }));

    await waitFor(() => expect(onChange).toHaveBeenCalledExactlyOnceWith({ status: 'closed' }));
  });

  it('reopens a closed Job through its named action', async () => {
    const onChange = vi.fn();
    const closed = { ...FIELD_COORDINATOR, status: 'closed' as const };
    server.use(
      ...signedInAs(RECRUITER),
      ...listsJobs([closed]),
      ...changesJob({ ...FIELD_COORDINATOR_VIEW, status: 'published' }, onChange),
    );

    const { user } = await renderApp('/jobs');
    await user.click(await screen.findByRole('button', { name: 'Actions for Field Coordinator' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Reopen job' }));

    await waitFor(() => expect(onChange).toHaveBeenCalledExactlyOnceWith({ status: 'published' }));
  });

  it('archives a Job through its named action', async () => {
    const onChange = vi.fn();
    server.use(
      ...signedInAs(RECRUITER),
      ...listsJobs([PROGRAMME_OFFICER]),
      ...changesJob({ ...PROGRAMME_OFFICER_VIEW, status: 'archived' }, onChange),
    );

    const { user } = await renderApp('/jobs');
    await user.click(await screen.findByRole('button', { name: 'Actions for Programme Officer' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Archive job' }));

    await waitFor(() => expect(onChange).toHaveBeenCalledExactlyOnceWith({ status: 'archived' }));
  });

  it("shows the server's reason when a lifecycle move is refused", async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...listsJobs([FIELD_COORDINATOR]),
      ...refusesJobChange({
        type: 'urn:sync:problem:invalid-job-transition',
        title: 'Conflict',
        status: 409,
        detail: 'This Job has changed since the list loaded. Refresh and try again.',
      }),
    );

    const { user } = await renderApp('/jobs');
    await user.click(await screen.findByRole('button', { name: 'Actions for Field Coordinator' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Close job' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This Job has changed since the list loaded. Refresh and try again.',
    );
  });
});
