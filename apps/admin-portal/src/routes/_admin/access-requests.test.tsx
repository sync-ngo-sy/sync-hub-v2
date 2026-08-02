import type { components } from '@sync/api-client';
import { http } from '@sync/api-client/testing';
import { screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { signedInAs } from '@/features/auth/testing/handlers';
import {
  convertsAccessRequest,
  dismissesAccessRequest,
  refusesConversion,
  respondsWithAccessRequests,
} from '@/features/platform/testing/handlers';
import { PLATFORM_ADMIN } from '@/testing/fixtures';
import { renderApp } from '@/testing/render-app';
import { server } from '@/testing/server';

const amanRequest: components['schemas']['AccessRequestView'] = {
  id: '00000000-0000-4000-8000-000000000201',
  company: 'Aman Relief',
  full_name: 'Rana Aljabri',
  email: 'rana@aman.test',
  created_at: '2026-07-30T09:15:00Z',
};

const basaltRequest: components['schemas']['AccessRequestView'] = {
  id: '00000000-0000-4000-8000-000000000202',
  company: 'Basalt Labs',
  full_name: 'Dima Khalil',
  email: 'dima@basalt.test',
  created_at: '2026-08-01T09:15:00Z',
};

const openedTenant: components['schemas']['CreatedTenantView'] = {
  tenant: {
    id: '00000000-0000-4000-8000-000000000203',
    name: 'Aman Relief',
    slug: 'aman-relief',
    plan: 'free',
    member_count: 1,
    is_active: true,
    invite_pending: true,
  },
  founding_admin: {
    id: '00000000-0000-4000-8000-000000000204',
    full_name: 'Rana Aljabri',
    email: 'rana@aman.test',
    role: 'admin',
    is_active: true,
  },
};

const SLUG_TAKEN: components['schemas']['ProblemDetail'] = {
  type: 'urn:sync:problem:tenant-slug-taken',
  title: 'Conflict',
  status: 409,
  detail: 'The address “aman-relief” is already taken. Choose another.',
};

describe('the access request queue', () => {
  it('lists what every waiting company told us, in the order they asked', async () => {
    server.use(
      ...signedInAs(PLATFORM_ADMIN),
      ...respondsWithAccessRequests([amanRequest, basaltRequest]),
    );

    await renderApp('/access-requests');

    const table = await screen.findByRole('table', { name: 'Access requests' });
    const row = within(table).getByRole('row', { name: /Aman Relief/ });
    expect(within(row).getByRole('cell', { name: 'Aman Relief' })).toBeVisible();
    expect(within(row).getByRole('cell', { name: 'Rana Aljabri' })).toBeVisible();
    expect(within(row).getByRole('cell', { name: 'rana@aman.test' })).toBeVisible();
    expect(
      within(table)
        .getAllByRole('row')
        .slice(1)
        .map((listed) => within(listed).getAllByRole('cell')[0]?.textContent),
    ).toEqual(['Aman Relief', 'Basalt Labs']);
  });

  it('says so plainly when nobody is waiting', async () => {
    server.use(...signedInAs(PLATFORM_ADMIN), ...respondsWithAccessRequests([]));

    await renderApp('/access-requests');

    expect(await screen.findByText('Nobody is waiting for access.')).toBeVisible();
  });

  it('converts a request without retyping it, asking only for the tenant address', async () => {
    const converted = vi.fn();
    let decided = false;
    server.use(
      ...signedInAs(PLATFORM_ADMIN),
      http.get('/v1/platform/access-requests', ({ response }) =>
        response(200).json(decided ? [basaltRequest] : [amanRequest, basaltRequest]),
      ),
      ...convertsAccessRequest(openedTenant, (slug) => {
        decided = true;
        converted(slug);
      }),
    );

    const { user } = await renderApp('/access-requests');
    await screen.findByRole('table', { name: 'Access requests' });
    await user.click(screen.getByRole('button', { name: 'Actions for Aman Relief' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Convert to tenant' }));

    const dialog = screen.getByRole('dialog', { name: 'Convert the request from Aman Relief' });
    expect(
      within(dialog).getByText(/Rana Aljabri \(rana@aman\.test\) becomes the founding admin/),
    ).toBeVisible();
    expect(within(dialog).getByLabelText('Tenant address')).toHaveValue('aman-relief');
    await user.click(within(dialog).getByRole('button', { name: 'Convert to tenant' }));

    expect(converted).toHaveBeenCalledWith('aman-relief');
    const table = await screen.findByRole('table', { name: 'Access requests' });
    expect(await within(table).findByRole('cell', { name: 'Basalt Labs' })).toBeVisible();
    expect(within(table).queryByRole('cell', { name: 'Aman Relief' })).not.toBeInTheDocument();
  });

  it('keeps the request waiting and says why when the conversion is refused', async () => {
    server.use(
      ...signedInAs(PLATFORM_ADMIN),
      ...respondsWithAccessRequests([amanRequest]),
      ...refusesConversion(SLUG_TAKEN),
    );

    const { user } = await renderApp('/access-requests');
    await screen.findByRole('table', { name: 'Access requests' });
    await user.click(screen.getByRole('button', { name: 'Actions for Aman Relief' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Convert to tenant' }));

    const dialog = screen.getByRole('dialog', { name: 'Convert the request from Aman Relief' });
    await user.click(within(dialog).getByRole('button', { name: 'Convert to tenant' }));

    expect(await within(dialog).findByText(SLUG_TAKEN.detail ?? '')).toBeVisible();
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    const table = await screen.findByRole('table', { name: 'Access requests' });
    expect(within(table).getByRole('cell', { name: 'Aman Relief' })).toBeVisible();
  });

  it('says what dismissing does before it does it, and drops the request afterwards', async () => {
    let dismissed = false;
    server.use(
      ...signedInAs(PLATFORM_ADMIN),
      http.get('/v1/platform/access-requests', ({ response }) =>
        response(200).json(dismissed ? [] : [amanRequest]),
      ),
      ...dismissesAccessRequest(amanRequest, () => {
        dismissed = true;
      }),
    );

    const { user } = await renderApp('/access-requests');
    await screen.findByRole('table', { name: 'Access requests' });
    await user.click(screen.getByRole('button', { name: 'Actions for Aman Relief' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Dismiss request' }));

    const dialog = screen.getByRole('alertdialog', {
      name: 'Dismiss the request from Aman Relief?',
    });
    expect(
      within(dialog).getByText(
        'It leaves the queue and no tenant is opened. Nothing is emailed to rana@aman.test, and they can ask again.',
      ),
    ).toBeVisible();
    await user.click(within(dialog).getByRole('button', { name: 'Dismiss request' }));

    expect(await screen.findByText('Nobody is waiting for access.')).toBeVisible();
  });

  it('is reachable from the platform navigation', async () => {
    server.use(...signedInAs(PLATFORM_ADMIN), ...respondsWithAccessRequests([]));

    const { router, user } = await renderApp('/overview');
    await user.click(
      within(screen.getByRole('navigation', { name: 'Platform' })).getByRole('link', {
        name: 'Access requests',
      }),
    );

    expect(router.state.location.pathname).toBe('/access-requests');
    expect(await screen.findByRole('heading', { name: 'Access requests' })).toBeVisible();
  });
});
