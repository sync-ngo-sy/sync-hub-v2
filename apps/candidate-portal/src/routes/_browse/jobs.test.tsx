import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { signedInAs, signedOut } from '@/features/auth/testing/handlers';
import {
  filtersJobs,
  listsJobs,
  pagesJobs,
  publishesNothing,
  ratelimitsJobs,
  withholdsJobs,
} from '@/features/jobs/testing/handlers';
import { CANDIDATE, MORE_PUBLIC_JOBS, PUBLIC_JOBS, TOO_MANY_REQUESTS } from '@/testing/fixtures';
import { renderApp } from '@/testing/render-app';
import { server } from '@/testing/server';

describe('browsing jobs', () => {
  it('lists the published jobs newest-first, each row leading to that Job', async () => {
    server.use(...signedOut(), ...listsJobs(PUBLIC_JOBS));

    await renderApp('/jobs');

    const list = await screen.findByRole('list', { name: 'Jobs' });
    expect(
      within(list)
        .getAllByRole('link')
        .map((row) => row.getAttribute('href')),
    ).toEqual(PUBLIC_JOBS.map((job) => `/jobs/${job.id}`));

    const developer = within(list).getByRole('link', { name: /Frontend Developer/ });
    expect(
      within(developer).getByText('Levant Digital · Damascus · Remote · Full time'),
    ).toBeVisible();
    const pharmacist = within(list).getByRole('link', { name: /Pharmacist/ });
    expect(within(pharmacist).getByText('Sham Care · Anywhere · Remote')).toBeVisible();
  });

  it('marks each row with the Tenant behind it, by its logo or by its letters', async () => {
    server.use(...signedOut(), ...listsJobs(PUBLIC_JOBS));

    await renderApp('/jobs');

    const list = await screen.findByRole('list', { name: 'Jobs' });
    const developer = within(list).getByRole('link', { name: /Frontend Developer/ });
    expect(developer.querySelector('[data-slot="tenant-logo"] img')).toHaveAttribute(
      'src',
      'http://sync.test/storage/v1/object/public/tenant-logos/levant/logo.webp',
    );
    const pharmacist = within(list).getByRole('link', { name: /Pharmacist/ });
    expect(pharmacist.querySelector('[data-slot="tenant-logo"] img')).toBeNull();
    expect(within(pharmacist).getByText('SC')).toBeVisible();
  });

  it('appends the next page on demand, and stops offering one at the end of the list', async () => {
    server.use(...signedOut(), ...pagesJobs([PUBLIC_JOBS, MORE_PUBLIC_JOBS]));

    const { user } = await renderApp('/jobs');

    const list = await screen.findByRole('list', { name: 'Jobs' });
    expect(within(list).getAllByRole('link')).toHaveLength(PUBLIC_JOBS.length);

    await user.click(screen.getByRole('button', { name: 'Load more jobs' }));

    await waitFor(() =>
      expect(within(list).getByRole('link', { name: /Logistics Officer/ })).toBeVisible(),
    );
    expect(within(list).getAllByRole('link')).toHaveLength(
      PUBLIC_JOBS.length + MORE_PUBLIC_JOBS.length,
    );
    expect(screen.queryByRole('button', { name: 'Load more jobs' })).toBeNull();
  });

  it('holds the page open with a skeleton list while the first page loads', async () => {
    server.use(...signedOut(), ...withholdsJobs());

    await renderApp('/jobs');

    expect(screen.getByRole('status', { name: 'Loading jobs' })).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Jobs' })).toBeNull();
    expect(screen.getByRole('heading', { name: 'Jobs' })).toBeVisible();
  });

  it('invites a visitor to be ready when nothing is published yet', async () => {
    server.use(...signedOut(), ...publishesNothing());

    await renderApp('/jobs');

    expect(await screen.findByText(/No roles are open right now/)).toBeVisible();
    expect(screen.getByRole('link', { name: 'Create your profile' })).toHaveAttribute(
      'href',
      '/signup',
    );
    expect(screen.queryByRole('list', { name: 'Jobs' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Load more jobs' })).toBeNull();
  });

  it('sends a signed-in candidate to their profile when nothing is published yet', async () => {
    server.use(...signedInAs(CANDIDATE), ...publishesNothing());

    await renderApp('/jobs');

    expect(await screen.findByRole('link', { name: 'Keep your CV ready' })).toHaveAttribute(
      'href',
      '/profile',
    );
    expect(screen.queryByRole('link', { name: 'Create your profile' })).toBeNull();
  });

  it('offers a retry when the jobs cannot be loaded, and keeps the page around it', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    server.use(...signedOut(), ...ratelimitsJobs());

    const { user } = await renderApp('/jobs');

    expect(await screen.findByText("Couldn't load the jobs")).toBeVisible();
    expect(screen.getByText(TOO_MANY_REQUESTS.detail as string)).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Jobs' })).toBeVisible();
    expect(consoleError).toHaveBeenCalledWith(
      '[widget: Jobs]',
      expect.objectContaining({ status: 429 }),
    );

    server.use(...listsJobs(PUBLIC_JOBS));
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByRole('list', { name: 'Jobs' })).toBeVisible();
    expect(screen.queryByText("Couldn't load the jobs")).toBeNull();
  });
});

describe('filtering jobs', () => {
  function rows() {
    const list = screen.queryByRole('list', { name: 'Jobs' });
    return list === null
      ? []
      : within(list)
          .getAllByRole('link')
          .map((row) => row.textContent ?? '');
  }

  function records() {
    const asked: URLSearchParams[] = [];
    return { asked, spy: (query: URLSearchParams) => asked.push(query) };
  }

  it('narrows the list to one Location, and says so in the address bar', async () => {
    server.use(...signedOut(), ...filtersJobs(PUBLIC_JOBS));

    const { user, router } = await renderApp('/jobs');
    await screen.findByRole('list', { name: 'Jobs' });

    await user.click(screen.getByRole('combobox', { name: 'Location' }));
    await user.click(await screen.findByRole('option', { name: 'Aleppo' }));

    await waitFor(() => expect(router.state.location.searchStr).toBe('?location=sy-aleppo'));
    await waitFor(() =>
      expect(rows()).toEqual([
        expect.stringContaining('Field Coordinator'),
        expect.stringContaining('Pharmacist'),
      ]),
    );
  });

  it('keeps the work that can be done Anywhere in a list narrowed to one Location', async () => {
    server.use(...signedOut(), ...filtersJobs(PUBLIC_JOBS));

    await renderApp('/jobs?location=sy-damascus');

    await waitFor(() =>
      expect(rows()).toEqual([
        expect.stringContaining('Frontend Developer'),
        expect.stringContaining('Anywhere'),
      ]),
    );
  });

  it('narrows the list to one work mode, and says so in the address bar', async () => {
    server.use(...signedOut(), ...filtersJobs(PUBLIC_JOBS));

    const { user, router } = await renderApp('/jobs');
    await screen.findByRole('list', { name: 'Jobs' });

    await user.click(screen.getByLabelText('Work mode'));
    await user.click(await screen.findByRole('option', { name: 'On-site' }));

    await waitFor(() => expect(router.state.location.searchStr).toBe('?mode=onsite'));
    await waitFor(() => expect(rows()).toEqual([expect.stringContaining('Field Coordinator')]));
  });

  it('narrows the list to one employment type', async () => {
    server.use(...signedOut(), ...filtersJobs(PUBLIC_JOBS));

    const { user, router } = await renderApp('/jobs');
    await screen.findByRole('list', { name: 'Jobs' });

    await user.click(screen.getByLabelText('Employment type'));
    await user.click(await screen.findByRole('option', { name: 'Full time' }));

    await waitFor(() => expect(router.state.location.searchStr).toBe('?type=full_time'));
    await waitFor(() => expect(rows()).toEqual([expect.stringContaining('Frontend Developer')]));
  });

  it('searches by keyword from the keyboard alone, without reaching for a button', async () => {
    server.use(...signedOut(), ...filtersJobs(PUBLIC_JOBS));

    const { user, router } = await renderApp('/jobs');
    await screen.findByRole('list', { name: 'Jobs' });

    await user.type(screen.getByRole('searchbox', { name: 'Search jobs' }), 'pharmacist{Enter}');

    await waitFor(() => expect(router.state.location.searchStr).toBe('?q=pharmacist'));
    await waitFor(() => expect(rows()).toEqual([expect.stringContaining('Pharmacist')]));
  });

  it('composes all four, carrying a keyword still in the box into the next choice', async () => {
    const { asked, spy } = records();
    server.use(...signedOut(), ...filtersJobs(PUBLIC_JOBS, spy));

    const { user, router } = await renderApp('/jobs');
    await screen.findByRole('list', { name: 'Jobs' });

    await user.type(screen.getByRole('searchbox', { name: 'Search jobs' }), 'coordinator');
    await user.click(screen.getByRole('combobox', { name: 'Location' }));
    await user.click(await screen.findByRole('option', { name: 'Aleppo' }));
    await user.click(screen.getByLabelText('Work mode'));
    await user.click(await screen.findByRole('option', { name: 'On-site' }));
    await user.click(screen.getByLabelText('Employment type'));
    await user.click(await screen.findByRole('option', { name: 'Contract' }));

    await waitFor(() =>
      expect(router.state.location.search).toEqual({
        q: 'coordinator',
        location: 'sy-aleppo',
        mode: 'onsite',
        type: 'contract',
      }),
    );
    await waitFor(() => expect(rows()).toEqual([expect.stringContaining('Field Coordinator')]));
    expect(Object.fromEntries(asked.at(-1) ?? [])).toMatchObject({
      q: 'coordinator',
      location_key: 'sy-aleppo',
      work_mode: 'onsite',
      employment_type: 'contract',
    });
  });

  it('reproduces the filtered list, and the bar, from a pasted link', async () => {
    const { asked, spy } = records();
    server.use(...signedOut(), ...filtersJobs(PUBLIC_JOBS, spy));

    await renderApp('/jobs?q=field&location=sy-aleppo&type=contract&mode=onsite');

    await waitFor(() => expect(rows()).toEqual([expect.stringContaining('Field Coordinator')]));
    expect(screen.getByRole('searchbox', { name: 'Search jobs' })).toHaveValue('field');
    expect(await screen.findByRole('combobox', { name: 'Location' })).toHaveValue('Aleppo');
    expect(screen.getByLabelText('Work mode')).toHaveTextContent('On-site');
    expect(screen.getByLabelText('Employment type')).toHaveTextContent('Contract');
    expect(Object.fromEntries(asked[0] ?? [])).toMatchObject({
      q: 'field',
      location_key: 'sy-aleppo',
      work_mode: 'onsite',
      employment_type: 'contract',
    });
  });

  it('takes the last filter off with the back button, and the bar follows', async () => {
    server.use(...signedOut(), ...filtersJobs(PUBLIC_JOBS));

    const { user, router } = await renderApp('/jobs?q=field');
    await screen.findByRole('list', { name: 'Jobs' });

    await user.click(screen.getByRole('combobox', { name: 'Location' }));
    await user.click(await screen.findByRole('option', { name: 'Aleppo' }));
    await waitFor(() =>
      expect(router.state.location.search).toEqual({ q: 'field', location: 'sy-aleppo' }),
    );

    router.history.back();

    await waitFor(() => expect(router.state.location.search).toEqual({ q: 'field' }));
    expect(screen.getByRole('combobox', { name: 'Location' })).toHaveValue('');
    expect(screen.getByRole('searchbox', { name: 'Search jobs' })).toHaveValue('field');
  });

  it('clears every filter in one action', async () => {
    server.use(...signedOut(), ...filtersJobs(PUBLIC_JOBS));

    const { user, router } = await renderApp(
      '/jobs?q=field&location=sy-aleppo&type=contract&mode=onsite',
    );
    await waitFor(() => expect(rows()).toEqual([expect.stringContaining('Field Coordinator')]));

    await user.click(screen.getByRole('button', { name: 'Clear filters' }));

    await waitFor(() => expect(router.state.location.searchStr).toBe(''));
    await waitFor(() => expect(rows()).toHaveLength(PUBLIC_JOBS.length));
    expect(screen.getByRole('searchbox', { name: 'Search jobs' })).toHaveValue('');
    expect(screen.getByRole('combobox', { name: 'Location' })).toHaveValue('');
    expect(screen.getByLabelText('Work mode')).toHaveTextContent('Any work mode');
    expect(screen.getByLabelText('Employment type')).toHaveTextContent('Any type');
    expect(screen.queryByRole('button', { name: 'Clear filters' })).toBeNull();
  });

  it('drops one filter without touching the others', async () => {
    server.use(...signedOut(), ...filtersJobs(PUBLIC_JOBS));

    const { user, router } = await renderApp('/jobs?q=field&location=sy-aleppo&type=contract');
    await waitFor(() => expect(rows()).toEqual([expect.stringContaining('Field Coordinator')]));

    await user.clear(await screen.findByRole('combobox', { name: 'Location' }));

    await waitFor(() =>
      expect(router.state.location.search).toEqual({ q: 'field', type: 'contract' }),
    );
  });

  it('clears a keyword typed but never applied, so nothing survives the one action', async () => {
    server.use(...signedOut(), ...filtersJobs(PUBLIC_JOBS));

    const { user, router } = await renderApp('/jobs?mode=onsite');
    await waitFor(() => expect(rows()).toEqual([expect.stringContaining('Field Coordinator')]));
    await user.type(screen.getByRole('searchbox', { name: 'Search jobs' }), 'nurse');

    await user.click(screen.getByRole('button', { name: 'Clear filters' }));

    await waitFor(() => expect(router.state.location.searchStr).toBe(''));
    expect(screen.getByRole('searchbox', { name: 'Search jobs' })).toHaveValue('');
    expect(rows()).toHaveLength(PUBLIC_JOBS.length);

    await user.click(screen.getByLabelText('Employment type'));
    await user.click(await screen.findByRole('option', { name: 'Contract' }));

    await waitFor(() => expect(router.state.location.search).toEqual({ type: 'contract' }));
  });

  it('says a combination matches nothing, not that the platform has nothing', async () => {
    server.use(...signedOut(), ...filtersJobs(PUBLIC_JOBS));

    const { user } = await renderApp('/jobs');
    await screen.findByRole('list', { name: 'Jobs' });

    await user.click(screen.getByLabelText('Work mode'));
    await user.click(await screen.findByRole('option', { name: 'Hybrid' }));

    expect(await screen.findByText(/No open roles match these filters/)).toBeVisible();
    expect(screen.queryByText(/No roles are open right now/)).toBeNull();
    expect(screen.queryByRole('list', { name: 'Jobs' })).toBeNull();

    const bar = screen.getByRole('searchbox', { name: 'Search jobs' }).closest('form');
    const fromEmptyState = screen
      .getAllByRole('button', { name: 'Clear filters' })
      .filter((button) => bar?.contains(button) !== true);
    expect(fromEmptyState).toHaveLength(1);
    await user.click(fromEmptyState[0] as HTMLElement);

    await waitFor(() => expect(rows()).toHaveLength(PUBLIC_JOBS.length));
  });

  it('keeps the filters applied on the page after the first', async () => {
    const { asked, spy } = records();
    server.use(...signedOut(), ...pagesJobs([PUBLIC_JOBS, MORE_PUBLIC_JOBS], spy));

    const { user } = await renderApp('/jobs');
    await screen.findByRole('list', { name: 'Jobs' });

    await user.click(screen.getByLabelText('Employment type'));
    await user.click(await screen.findByRole('option', { name: 'Contract' }));
    await waitFor(() => expect(asked.at(-1)?.get('employment_type')).toBe('contract'));

    await user.click(await screen.findByRole('button', { name: 'Load more jobs' }));

    await waitFor(() => expect(asked.at(-1)?.get('cursor')).toBe('1'));
    expect(asked.at(-1)?.get('employment_type')).toBe('contract');
  });

  it('drops an employment type a stale link carries rather than emptying the page', async () => {
    const { asked, spy } = records();
    server.use(...signedOut(), ...filtersJobs(PUBLIC_JOBS, spy));

    await renderApp('/jobs?type=apprenticeship');

    await waitFor(() => expect(rows()).toHaveLength(PUBLIC_JOBS.length));
    expect(asked[0]?.get('employment_type')).toBeNull();
    expect(screen.getByLabelText('Employment type')).toHaveTextContent('Any type');
  });
});
