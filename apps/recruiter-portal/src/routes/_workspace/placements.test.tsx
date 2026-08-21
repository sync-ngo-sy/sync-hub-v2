import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { signedInAs } from '@/features/auth/testing/handlers';
import type { HireConfirmation } from '@/features/placements/placement';
import {
  claimedHires,
  EVERY_CLAIM,
  LAYLA_DENIED,
  NOUR_PLACED,
  SAMER_WAITING,
} from '@/features/placements/testing/fixtures';
import {
  failsToListHireClaims,
  holdsHireClaims,
  pagesHireClaims,
} from '@/features/placements/testing/handlers';
import { RECRUITER, SERVER_FAULT } from '@/testing/fixtures';
import { renderApp } from '@/testing/render-app';
import { server } from '@/testing/server';

const AT = '/placements';

function tabs() {
  return within(screen.getByRole('radiogroup', { name: 'Hire claims' }));
}

function names() {
  return screen
    .getAllByRole('link', { name: /Application$/ })
    .map((row) => row.getAttribute('aria-label'));
}

describe('the Placements page', () => {
  it('opens on the hires the Candidate confirmed, without the address saying so', async () => {
    const asked: HireConfirmation[] = [];
    server.use(...signedInAs(RECRUITER), ...holdsHireClaims(EVERY_CLAIM, asked));

    const { router } = await renderApp(AT);

    expect(await screen.findByText('Nour Haddad')).toBeVisible();
    expect(names()).toEqual(["Open Nour Haddad's Application"]);
    expect(asked).toEqual(['confirmed']);
    expect(router.state.location.search).toEqual({});
  });

  it('holds every Hire claim in three tabs, each carrying its own count', async () => {
    server.use(...signedInAs(RECRUITER), ...holdsHireClaims(EVERY_CLAIM));

    await renderApp(AT);

    await waitFor(() =>
      expect(
        tabs()
          .getAllByRole('radio')
          .map((chip) => chip.getAttribute('aria-label')),
      ).toEqual(['Placements 1', 'Waiting 1', 'Denied 1']),
    );
    expect(tabs().queryByRole('radio', { name: /^All/ })).toBeNull();
  });

  it('names the person, the Job, the day the work started and where the claim stands', async () => {
    server.use(...signedInAs(RECRUITER), ...holdsHireClaims([NOUR_PLACED]));

    await renderApp(AT);

    const row = within(await screen.findByRole('row', { name: /Nour Haddad/ }));
    expect(row.getByText('MEAL Officer')).toBeVisible();
    expect(row.getByText('September 1, 2026')).toBeVisible();
    expect(row.getByText('Confirmed')).toBeVisible();
  });

  it('opens the Application from the name and the Job from its own column', async () => {
    server.use(...signedInAs(RECRUITER), ...holdsHireClaims([NOUR_PLACED]));

    await renderApp(AT);

    expect(
      await screen.findByRole('link', { name: "Open Nour Haddad's Application" }),
    ).toHaveAttribute('href', `/applications/${NOUR_PLACED.application_id}?from=placements`);
    const row = within(screen.getByRole('row', { name: /Nour Haddad/ }));
    expect(row.getByRole('link', { name: /MEAL Officer/ })).toHaveAttribute(
      'href',
      `/jobs/${NOUR_PLACED.job.id}`,
    );
  });

  it('writes a chosen tab into the address and leaves the one it opens on unwritten', async () => {
    const asked: HireConfirmation[] = [];
    server.use(...signedInAs(RECRUITER), ...holdsHireClaims(EVERY_CLAIM, asked));
    const { router, user } = await renderApp(AT);

    await user.click(tabs().getByRole('radio', { name: /^Waiting/ }));

    await waitFor(() => expect(router.state.location.search).toEqual({ tab: 'unanswered' }));
    expect(await screen.findByText('Samer Khoury')).toBeVisible();

    await user.click(tabs().getByRole('radio', { name: /^Placements/ }));

    await waitFor(() => expect(router.state.location.search).toEqual({}));
    expect(await screen.findByText('Nour Haddad')).toBeVisible();
    expect(asked).toEqual(['confirmed', 'unanswered']);
  });

  it('reads an unanswered claim its age rather than resolving it', async () => {
    server.use(...signedInAs(RECRUITER), ...holdsHireClaims([SAMER_WAITING]));

    await renderApp(`${AT}?tab=unanswered`);

    const row = within(await screen.findByRole('row', { name: /Samer Khoury/ }));
    expect(row.getByText('Waiting since March 4, 2026')).toBeVisible();
  });

  it('keeps a denied claim readable on its own tab', async () => {
    server.use(...signedInAs(RECRUITER), ...holdsHireClaims([LAYLA_DENIED]));

    await renderApp(`${AT}?tab=denied`);

    const row = within(await screen.findByRole('row', { name: /Layla Aziz/ }));
    expect(row.getByText('Denied')).toBeVisible();
  });

  it('brings the next page in on request rather than reading every claim at once', async () => {
    const [first, second] = [claimedHires(20, 'confirmed'), claimedHires(3, 'confirmed')];
    server.use(...signedInAs(RECRUITER), ...pagesHireClaims([first, second]));
    const { user } = await renderApp(AT);

    expect(await screen.findByText('20 shown')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Load more' }));

    expect(await screen.findByText('23 shown')).toBeVisible();
  });

  it('says a tab is empty in that tab’s own words', async () => {
    server.use(...signedInAs(RECRUITER), ...holdsHireClaims([]));

    await renderApp(`${AT}?tab=unanswered`);

    expect(
      await screen.findByText(
        'Nothing is waiting — every hire your team has claimed has an answer.',
      ),
    ).toBeVisible();
    expect(screen.getByRole('link', { name: 'Go to the hired Applications' })).toBeVisible();
  });

  it('offers a way back when the claims cannot be read', async () => {
    server.use(...signedInAs(RECRUITER), ...failsToListHireClaims(SERVER_FAULT));
    const { user } = await renderApp(AT);

    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong on our side.');

    server.use(...holdsHireClaims([NOUR_PLACED]));
    await user.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByText('Nour Haddad')).toBeVisible();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('is a destination of its own in the Workspace', async () => {
    server.use(...signedInAs(RECRUITER), ...holdsHireClaims(EVERY_CLAIM));

    await renderApp(AT);

    const nav = screen.getByRole('navigation', { name: 'Workspace' });
    expect(within(nav).getByRole('link', { name: 'Placements' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });
});
