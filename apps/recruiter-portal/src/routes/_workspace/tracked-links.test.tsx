import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { signedInAs } from '@/features/auth/testing/handlers';
import { FIELD_COORDINATOR_VIEW } from '@/features/jobs/testing/fixtures';
import { getsJob } from '@/features/jobs/testing/handlers';
import {
  TENANT_LINKEDIN_FIELD,
  TENANT_LINKEDIN_MEAL,
  TENANT_LINKS,
  TENANT_SPRING_CAMPAIGN,
  TENANT_UNIVERSITY_BOARD,
  TENANT_WHATSAPP,
} from '@/features/tracked-links/testing/fixtures';
import {
  failsToListTenantTrackedLinks,
  listsTenantTrackedLinks,
  pagesTenantTrackedLinks,
  recordsSearches,
} from '@/features/tracked-links/testing/tenant-handlers';
import { RECRUITER, SERVER_FAULT, TODAY } from '@/testing/fixtures';
import { renderApp } from '@/testing/render-app';
import { server } from '@/testing/server';

function table() {
  return within(screen.getByRole('table', { name: 'Tracked links' }));
}

async function rowNames() {
  const rows = await screen.findAllByRole('row');
  return rows
    .slice(1)
    .map((row) => within(row).getAllByRole('cell')[0]?.querySelector('span > span')?.textContent);
}

describe('the Tracked links page', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(TODAY);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('gathers every link of every Job into one list', async () => {
    server.use(...signedInAs(RECRUITER), ...listsTenantTrackedLinks(TENANT_LINKS));

    await renderApp('/tracked-links');

    expect(await screen.findByRole('heading', { level: 1, name: 'Tracked links' })).toBeVisible();
    expect(await table().findByText('WhatsApp groups')).toBeVisible();
    expect(table().getByText('Spring campaign')).toBeVisible();
  });

  it('keeps one campaign run on two Jobs as two rows', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...listsTenantTrackedLinks([TENANT_LINKEDIN_FIELD, TENANT_LINKEDIN_MEAL]),
    );

    await renderApp('/tracked-links');

    expect(await table().findAllByText('LinkedIn post')).toHaveLength(2);
    expect(table().getByRole('link', { name: 'Field Coordinator' })).toBeVisible();
    expect(table().getByRole('link', { name: 'MEAL Officer' })).toBeVisible();
  });

  it('says what each link brought and where it stands', async () => {
    server.use(...signedInAs(RECRUITER), ...listsTenantTrackedLinks([TENANT_LINKEDIN_FIELD]));

    await renderApp('/tracked-links');
    const rows = table();

    expect(await rows.findByText('342')).toBeVisible();
    expect(rows.getByText('41')).toBeVisible();
    expect(rows.getByText('12%')).toBeVisible();
    expect(rows.getByText('Live')).toBeVisible();
    expect(rows.getByText('Never')).toBeVisible();
  });

  it('reports a link nobody has followed without a rate over nothing', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...listsTenantTrackedLinks([
        {
          ...TENANT_LINKEDIN_FIELD,
          view_count: 0,
          application_count: 0,
          conversion_rate: null,
        },
      ]),
    );

    await renderApp('/tracked-links');
    const rows = table();

    expect(await rows.findByText('LinkedIn post')).toBeVisible();
    expect(rows.getByText('—')).toBeVisible();
  });

  it('calls a link past its date expired, though the API still calls it switched on', async () => {
    server.use(...signedInAs(RECRUITER), ...listsTenantTrackedLinks([TENANT_SPRING_CAMPAIGN]));

    await renderApp('/tracked-links');

    expect(await table().findByText('Expired')).toBeVisible();
  });

  it('calls a link somebody switched off, off', async () => {
    server.use(...signedInAs(RECRUITER), ...listsTenantTrackedLinks([TENANT_UNIVERSITY_BOARD]));

    await renderApp('/tracked-links');

    expect(await table().findByText('Off')).toBeVisible();
  });

  it('leads from a link to the Job that owns it', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...listsTenantTrackedLinks([TENANT_LINKEDIN_FIELD]),
      ...getsJob(FIELD_COORDINATOR_VIEW),
    );

    const { user } = await renderApp('/tracked-links');
    await user.click(await table().findByRole('link', { name: 'Field Coordinator' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Field Coordinator' }),
    ).toBeVisible();
  });

  it('narrows to what somebody typed', async () => {
    server.use(...signedInAs(RECRUITER), ...listsTenantTrackedLinks(TENANT_LINKS));

    const { user } = await renderApp('/tracked-links');
    await table().findByText('WhatsApp groups');

    await user.type(screen.getByLabelText('Search by name'), 'whatsapp');

    await waitFor(async () => expect(await rowNames()).toHaveLength(1));
    expect(table().getByText('WhatsApp groups')).toBeVisible();
  });

  it('asks the endpoint once for a typed word rather than once per letter', async () => {
    const asked: (string | null)[] = [];
    server.use(...signedInAs(RECRUITER), ...recordsSearches(TENANT_LINKS, asked));

    const { user } = await renderApp('/tracked-links');
    await table().findByText('WhatsApp groups');
    asked.length = 0;

    await user.type(screen.getByLabelText('Search by name'), 'whatsapp');
    await waitFor(() => expect(asked).toContain('whatsapp'));

    expect(asked.filter((term) => term !== null && term !== 'whatsapp')).toEqual([]);
  });

  it('keeps a search in the address, so it can be sent to somebody', async () => {
    server.use(...signedInAs(RECRUITER), ...listsTenantTrackedLinks(TENANT_LINKS));

    const { router, user } = await renderApp('/tracked-links');
    await table().findByText('WhatsApp groups');

    await user.type(screen.getByLabelText('Search by name'), 'whatsapp');

    await waitFor(() => expect(router.state.location.searchStr).toContain('q=whatsapp'));
  });

  it('opens on the search the address arrived with', async () => {
    server.use(...signedInAs(RECRUITER), ...listsTenantTrackedLinks(TENANT_LINKS));

    await renderApp('/tracked-links?q=whatsapp');

    expect(await table().findByText('WhatsApp groups')).toBeVisible();
    expect(screen.getByLabelText('Search by name')).toHaveValue('whatsapp');
  });

  it('says so plainly when a search matches nothing', async () => {
    server.use(...signedInAs(RECRUITER), ...listsTenantTrackedLinks(TENANT_LINKS));

    await renderApp('/tracked-links?q=telegram');

    expect(await screen.findByText('No tracked link matches “telegram”.')).toBeVisible();
  });

  it('offers a different empty state to a Tenant with no links at all', async () => {
    server.use(...signedInAs(RECRUITER), ...listsTenantTrackedLinks([]));

    await renderApp('/tracked-links');

    expect(await screen.findByText(/No tracked links yet/)).toBeVisible();
  });

  it('narrows to the links still switched on', async () => {
    server.use(...signedInAs(RECRUITER), ...listsTenantTrackedLinks(TENANT_LINKS));

    const { user } = await renderApp('/tracked-links');
    await table().findByText('WhatsApp groups');

    await user.click(screen.getByRole('tab', { name: 'Off' }));

    await waitFor(async () => expect(await rowNames()).toEqual(['University board']));
  });

  it('tells live from expired without asking the endpoint again', async () => {
    server.use(...signedInAs(RECRUITER), ...listsTenantTrackedLinks(TENANT_LINKS));

    const { user } = await renderApp('/tracked-links');
    await table().findByText('WhatsApp groups');

    await user.click(screen.getByRole('tab', { name: 'Expired' }));

    await waitFor(async () => expect(await rowNames()).toEqual(['Spring campaign']));
  });

  it('keeps the state in the address too', async () => {
    server.use(...signedInAs(RECRUITER), ...listsTenantTrackedLinks(TENANT_LINKS));

    const { router, user } = await renderApp('/tracked-links');
    await table().findByText('WhatsApp groups');

    await user.click(screen.getByRole('tab', { name: 'Off' }));

    await waitFor(() => expect(router.state.location.searchStr).toContain('state=off'));
  });

  it('fetches the next page when asked', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...pagesTenantTrackedLinks([[TENANT_LINKEDIN_FIELD], [TENANT_WHATSAPP]]),
    );

    const { user } = await renderApp('/tracked-links');
    expect(await table().findByText('LinkedIn post')).toBeVisible();

    await user.click(screen.getByRole('button', { name: /Load more/i }));

    expect(await table().findByText('WhatsApp groups')).toBeVisible();
  });

  it('refuses in place, with a Retry that recovers', async () => {
    server.use(...signedInAs(RECRUITER), ...failsToListTenantTrackedLinks(SERVER_FAULT));

    const { user } = await renderApp('/tracked-links');
    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong on our side.');

    server.use(...listsTenantTrackedLinks(TENANT_LINKS));
    await user.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await table().findByText('WhatsApp groups')).toBeVisible();
  });

  it('is reachable from the workspace nav', async () => {
    server.use(...signedInAs(RECRUITER), ...listsTenantTrackedLinks(TENANT_LINKS));

    const { user } = await renderApp('/tracked-links');
    const nav = within(screen.getByRole('navigation', { name: 'Workspace' }));

    await user.click(nav.getByRole('link', { name: 'Tracked links' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Tracked links' })).toBeVisible();
  });

  it('keeps what is being typed when an earlier search lands', async () => {
    server.use(...signedInAs(RECRUITER), ...listsTenantTrackedLinks(TENANT_LINKS));

    const { user } = await renderApp('/tracked-links');
    await table().findByText('WhatsApp groups');

    await user.type(screen.getByLabelText('Search by name'), 'whatsapp groups');

    await waitFor(() =>
      expect(screen.getByLabelText('Search by name')).toHaveValue('whatsapp groups'),
    );
  });

  it('does not call a filtered page an empty Tenant', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...listsTenantTrackedLinks([TENANT_LINKEDIN_FIELD, TENANT_WHATSAPP]),
    );

    const { user } = await renderApp('/tracked-links');
    await table().findByText('WhatsApp groups');

    await user.click(screen.getByRole('tab', { name: 'Expired' }));

    expect(await screen.findByText('None of your tracked links are expired.')).toBeVisible();
    expect(screen.queryByText(/No tracked links yet/)).not.toBeInTheDocument();
  });
});
