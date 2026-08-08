import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { signedInAs } from '@/features/auth/testing/handlers';
import { FIELD_COORDINATOR_VIEW } from '@/features/jobs/testing/fixtures';
import { getsJob } from '@/features/jobs/testing/handlers';
import {
  LINKEDIN_POST,
  NAME_TAKEN,
  UNIVERSITY_BOARD,
  WHATSAPP_GROUPS,
} from '@/features/tracked-links/testing/fixtures';
import {
  failsToListTrackedLinks,
  holdsTrackedLinkChange,
  holdsTrackedLinks,
  listsTrackedLinks,
  managesTrackedLinks,
  refusesTrackedLinkChange,
  refusesTrackedLinkMint,
} from '@/features/tracked-links/testing/handlers';
import { RECRUITER, SERVER_FAULT } from '@/testing/fixtures';
import { renderApp } from '@/testing/render-app';
import { server } from '@/testing/server';

const JOB = FIELD_COORDINATOR_VIEW;
const LINKS = `/jobs/${JOB.id}?tab=links`;

function rowOf(name: string) {
  return within(screen.getByRole('row', { name: new RegExp(name) }));
}

function rowArrives(name: string) {
  return screen.findByRole('row', { name: new RegExp(name) });
}

async function openActions(user: { click: (element: Element) => Promise<void> }, name: string) {
  await user.click(screen.getByRole('button', { name: `Actions for ${name}` }));
}

describe("a Job's Tracked links tab", () => {
  it('lists every link with its address, its views and what it is doing', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...getsJob(JOB),
      ...listsTrackedLinks([LINKEDIN_POST, WHATSAPP_GROUPS, UNIVERSITY_BOARD]),
    );

    await renderApp(LINKS);

    expect(await rowArrives('LinkedIn post')).toBeVisible();
    expect(rowOf('LinkedIn post').getByText('http://localhost:5173/l/QkJ9lC3nR1sT')).toBeVisible();
    expect(rowOf('LinkedIn post').getByText('342')).toBeVisible();
    expect(rowOf('LinkedIn post').getByText('Live')).toBeVisible();

    expect(rowOf('University board').getByText('41')).toBeVisible();
    expect(rowOf('University board').getByText('Off')).toBeVisible();
  });

  it('copies a link address in one click', async () => {
    server.use(...signedInAs(RECRUITER), ...getsJob(JOB), ...listsTrackedLinks([LINKEDIN_POST]));

    const { user } = await renderApp(LINKS);

    await user.click(
      await screen.findByRole('button', { name: 'Copy the address for LinkedIn post' }),
    );

    expect(await navigator.clipboard.readText()).toBe('http://localhost:5173/l/QkJ9lC3nR1sT');
    expect(await screen.findByText('Address copied')).toBeVisible();
  });

  it('mints a named link and hands its address straight back to copy', async () => {
    const links = managesTrackedLinks([LINKEDIN_POST]);
    server.use(...signedInAs(RECRUITER), ...getsJob(JOB), ...links.handlers);

    const { user } = await renderApp(LINKS);

    await user.click(await screen.findByRole('button', { name: 'Mint a tracked link' }));
    await user.type(screen.getByLabelText('Name'), 'Alumni newsletter');
    await user.click(screen.getByRole('button', { name: 'Mint link' }));

    const address = 'http://localhost:5173/l/MintedTok3n';
    const dialog = within(await screen.findByRole('dialog'));
    expect(dialog.getByText(address)).toBeVisible();

    await user.click(
      dialog.getByRole('button', { name: 'Copy the address for Alumni newsletter' }),
    );
    expect(await navigator.clipboard.readText()).toBe(address);

    await user.click(screen.getByRole('button', { name: 'Done' }));

    expect(await screen.findByRole('row', { name: /Alumni newsletter/ })).toBeVisible();
    expect(links.links.map((link) => link.name)).toEqual(['LinkedIn post', 'Alumni newsletter']);

    await user.click(screen.getByRole('button', { name: 'Mint a tracked link' }));
    expect(await screen.findByLabelText('Name')).toHaveValue('');
  });

  it('says which name the Job already uses rather than minting a second one', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...getsJob(JOB),
      ...listsTrackedLinks([LINKEDIN_POST]),
      ...refusesTrackedLinkMint(NAME_TAKEN),
    );

    const { user } = await renderApp(LINKS);

    await user.click(await screen.findByRole('button', { name: 'Mint a tracked link' }));
    await user.type(screen.getByLabelText('Name'), 'LinkedIn post');
    await user.click(screen.getByRole('button', { name: 'Mint link' }));

    expect(await screen.findByText(NAME_TAKEN.detail)).toBeVisible();
  });

  it('asks for a name before it mints anything', async () => {
    server.use(...signedInAs(RECRUITER), ...getsJob(JOB), ...listsTrackedLinks([LINKEDIN_POST]));

    const { user } = await renderApp(LINKS);

    await user.click(await screen.findByRole('button', { name: 'Mint a tracked link' }));
    await user.click(screen.getByRole('button', { name: 'Mint link' }));

    expect(await screen.findByText('Name the channel this link is for.')).toBeVisible();
  });

  it('renames a link in place, keeping the address and the views it brought', async () => {
    const links = managesTrackedLinks([LINKEDIN_POST]);
    server.use(...signedInAs(RECRUITER), ...getsJob(JOB), ...links.handlers);

    const { user } = await renderApp(LINKS);

    expect(await rowArrives('LinkedIn post')).toBeVisible();
    await openActions(user, 'LinkedIn post');
    await user.click(await screen.findByRole('menuitem', { name: 'Rename link' }));

    const name = screen.getByLabelText('Name');
    await user.clear(name);
    await user.type(name, 'LinkedIn — jobs group');
    await user.click(screen.getByRole('button', { name: 'Save name' }));

    expect(await screen.findByText('Tracked link renamed')).toBeVisible();
    const renamed = rowOf('LinkedIn — jobs group');
    expect(renamed.getByText('http://localhost:5173/l/QkJ9lC3nR1sT')).toBeVisible();
    expect(renamed.getByText('342')).toBeVisible();
    expect(screen.queryByText('LinkedIn post')).toBeNull();
  });

  it('turns a link off and leaves it listed with the views it already brought', async () => {
    const links = managesTrackedLinks([LINKEDIN_POST]);
    server.use(...signedInAs(RECRUITER), ...getsJob(JOB), ...links.handlers);

    const { user } = await renderApp(LINKS);

    expect(await rowArrives('LinkedIn post')).toBeVisible();
    await openActions(user, 'LinkedIn post');
    await user.click(await screen.findByRole('menuitem', { name: 'Turn link off' }));

    expect(
      await screen.findByText(
        'Tracked link turned off — its address stops working, and the views it brought stay counted.',
      ),
    ).toBeVisible();
    await waitFor(() => expect(rowOf('LinkedIn post').getByText('Off')).toBeVisible());
    expect(rowOf('LinkedIn post').getByText('342')).toBeVisible();
    expect(links.links.map((link) => link.is_active)).toEqual([false]);
  });

  it('turns a link back on', async () => {
    const links = managesTrackedLinks([UNIVERSITY_BOARD]);
    server.use(...signedInAs(RECRUITER), ...getsJob(JOB), ...links.handlers);

    const { user } = await renderApp(LINKS);

    expect(await rowArrives('University board')).toBeVisible();
    await openActions(user, 'University board');
    await user.click(await screen.findByRole('menuitem', { name: 'Turn link back on' }));

    await waitFor(() => expect(rowOf('University board').getByText('Live')).toBeVisible());
    expect(links.links.map((link) => link.is_active)).toEqual([true]);
  });

  it('reports a refused change without pretending the link moved', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...getsJob(JOB),
      ...listsTrackedLinks([LINKEDIN_POST]),
      ...refusesTrackedLinkChange(NAME_TAKEN),
    );

    const { user } = await renderApp(LINKS);

    expect(await rowArrives('LinkedIn post')).toBeVisible();
    await openActions(user, 'LinkedIn post');
    await user.click(await screen.findByRole('menuitem', { name: 'Turn link off' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(NAME_TAKEN.detail);
    expect(rowOf('LinkedIn post').getByText('Live')).toBeVisible();
  });

  it('charts every source of the views, the busiest first, Direct among them', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...getsJob(JOB),
      ...listsTrackedLinks([UNIVERSITY_BOARD, LINKEDIN_POST, WHATSAPP_GROUPS], 100),
    );

    await renderApp(LINKS);

    expect(
      await screen.findByRole('img', {
        name: 'Views per source. LinkedIn post: 342 views, 45%. WhatsApp groups: 281 views, 37%. Direct: 100 views, 13%. University board: 41 views, 5%.',
      }),
    ).toBeInTheDocument();
  });

  it('reports Direct as zero when every view arrived through a link', async () => {
    const tracked = { ...JOB, view_count: 342 };
    server.use(
      ...signedInAs(RECRUITER),
      ...getsJob(tracked),
      ...listsTrackedLinks([LINKEDIN_POST]),
    );

    await renderApp(LINKS);

    expect(
      await screen.findByRole('img', {
        name: 'Views per source. LinkedIn post: 342 views, 100%. Direct: 0 views, 0%.',
      }),
    ).toBeInTheDocument();
  });

  it('shows each link as a share of everything the Job has drawn', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...getsJob(JOB),
      ...listsTrackedLinks([LINKEDIN_POST, WHATSAPP_GROUPS, UNIVERSITY_BOARD], 100),
    );

    await renderApp(LINKS);
    expect(await rowArrives('LinkedIn post')).toBeVisible();

    expect(rowOf('LinkedIn post').getByText('45%')).toBeVisible();
    expect(rowOf('WhatsApp groups').getByText('37%')).toBeVisible();
    expect(rowOf('University board').getByText('5%')).toBeVisible();
  });

  it('says the chart is waiting when nobody has read the Job yet', async () => {
    const unread = { ...JOB, view_count: 0 };
    server.use(
      ...signedInAs(RECRUITER),
      ...getsJob(unread),
      ...listsTrackedLinks([{ ...LINKEDIN_POST, view_count: 0 }]),
    );

    await renderApp(LINKS);

    expect(
      await screen.findByText('No views yet — the counts fill in as candidates open this Job.'),
    ).toBeVisible();
    expect(screen.queryByRole('img', { name: /Views per source/ })).toBeNull();
    expect(rowOf('LinkedIn post').getByText('—')).toBeVisible();
  });

  it('explains what a tracked link is for when the Job has none', async () => {
    const links = managesTrackedLinks([]);
    server.use(...signedInAs(RECRUITER), ...getsJob(JOB), ...links.handlers);

    const { user } = await renderApp(LINKS);

    expect(
      await screen.findByText(
        'A tracked link is a named address for this Job, so you can tell which channel brought which views.',
      ),
    ).toBeVisible();
    expect(screen.queryByRole('img', { name: /Views per source/ })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Mint the first link' }));
    await user.type(screen.getByLabelText('Name'), 'Alumni newsletter');
    await user.click(screen.getByRole('button', { name: 'Mint link' }));

    const dialog = within(await screen.findByRole('dialog'));
    expect(await dialog.findByText('http://localhost:5173/l/MintedTok3n')).toBeVisible();
  });

  it('reports Direct traffic when the Job has no tracked links', async () => {
    server.use(...signedInAs(RECRUITER), ...getsJob(JOB), ...listsTrackedLinks([], JOB.view_count));

    await renderApp(LINKS);

    expect(
      await screen.findByRole('img', {
        name: `Views per source. Direct: ${JOB.view_count} views, 100%.`,
      }),
    ).toBeInTheDocument();
  });

  it('stands a skeleton in the table while the links are on the wire', async () => {
    const held = holdsTrackedLinks([LINKEDIN_POST]);
    server.use(...signedInAs(RECRUITER), ...getsJob(JOB), ...held.handlers);

    await renderApp(LINKS);

    expect(await screen.findByRole('columnheader', { name: 'Link' })).toBeVisible();
    expect(document.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);

    held.arrive();

    expect(await rowArrives('LinkedIn post')).toBeVisible();
  });

  it('reports a failed list inline and reloads it on retry', async () => {
    server.use(...signedInAs(RECRUITER), ...getsJob(JOB), ...failsToListTrackedLinks(SERVER_FAULT));

    const { user } = await renderApp(LINKS);

    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong on our side.');

    server.use(...listsTrackedLinks([LINKEDIN_POST]));
    await user.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await rowArrives('LinkedIn post')).toBeVisible();
  });

  it('still offers minting when the list itself could not be read', async () => {
    server.use(...signedInAs(RECRUITER), ...getsJob(JOB), ...failsToListTrackedLinks(SERVER_FAULT));

    await renderApp(LINKS);

    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong on our side.');
    expect(screen.getByRole('button', { name: 'Mint a tracked link' })).toBeVisible();
  });

  it('sends one change however often the recruiter asks while it is in flight', async () => {
    const change = holdsTrackedLinkChange({ ...LINKEDIN_POST, is_active: false });
    server.use(
      ...signedInAs(RECRUITER),
      ...getsJob(JOB),
      ...listsTrackedLinks([LINKEDIN_POST]),
      ...change.handlers,
    );

    const { user } = await renderApp(LINKS);

    expect(await rowArrives('LinkedIn post')).toBeVisible();
    await openActions(user, 'LinkedIn post');
    await user.click(await screen.findByRole('menuitem', { name: 'Turn link off' }));
    await openActions(user, 'LinkedIn post');
    await user.click(await screen.findByRole('menuitem', { name: 'Turn link off' }));

    change.arrive();

    expect(
      await screen.findByText(
        'Tracked link turned off — its address stops working, and the views it brought stay counted.',
      ),
    ).toBeVisible();
    expect(change.asked).toEqual([LINKEDIN_POST.id]);
  });
});
