import type { components } from '@sync/api-client';
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { signedInAs } from '@/features/auth/testing/handlers';
import {
  createsPlatformTenant,
  resendsFoundingAdminInvite,
  respondsWithPlatformTenants,
  setsPlatformTenantStatus,
} from '@/features/platform/testing/handlers';
import { PLATFORM_ADMIN } from '@/testing/fixtures';
import { renderApp } from '@/testing/render-app';
import { server } from '@/testing/server';

const activeTenant: components['schemas']['PlatformTenantView'] = {
  id: '00000000-0000-4000-8000-000000000101',
  name: 'Aman Foundation',
  slug: 'aman-foundation',
  plan: 'pro',
  member_count: 8,
  is_active: true,
  invite_pending: false,
};

const createdTenant: components['schemas']['CreatedTenantView'] = {
  tenant: {
    id: '00000000-0000-4000-8000-000000000102',
    name: 'Basalt Labs',
    slug: 'basalt-labs',
    plan: 'free',
    member_count: 1,
    is_active: true,
    invite_pending: true,
  },
  founding_admin: {
    id: '00000000-0000-4000-8000-000000000103',
    full_name: 'Dima Khalil',
    email: 'dima@basalt.test',
    role: 'admin',
    is_active: true,
  },
};

const pendingTenant: components['schemas']['PlatformTenantView'] = {
  ...activeTenant,
  invite_pending: true,
};

const foundingAdmin: components['schemas']['MemberView'] = {
  id: '00000000-0000-4000-8000-000000000104',
  full_name: 'Rana Aljabri',
  email: 'rana@aman.test',
  role: 'admin',
  is_active: true,
};

describe('tenant operations', () => {
  it('lists tenants and adds a newly created tenant to the visible table', async () => {
    server.use(
      ...signedInAs(PLATFORM_ADMIN),
      ...respondsWithPlatformTenants([activeTenant]),
      ...createsPlatformTenant(createdTenant),
    );

    const { user } = await renderApp('/tenants');

    const table = await screen.findByRole('table', { name: 'Platform tenants' });
    expect(within(table).getByRole('cell', { name: 'Aman Foundation' })).toBeVisible();
    expect(within(table).getByRole('cell', { name: 'Pro' })).toBeVisible();
    expect(within(table).getByRole('cell', { name: '8' })).toBeVisible();
    expect(screen.queryByRole('button', { name: /plan/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Create tenant' }));
    const dialog = screen.getByRole('dialog', { name: 'Create tenant' });
    await user.type(within(dialog).getByLabelText('Tenant name'), 'Basalt Labs');
    await user.type(within(dialog).getByLabelText('Tenant address'), 'basalt-labs');
    await user.type(within(dialog).getByLabelText('Founding admin name'), 'Dima Khalil');
    await user.type(within(dialog).getByLabelText('Founding admin email'), 'dima@basalt.test');
    await user.click(within(dialog).getByRole('button', { name: 'Create tenant' }));

    expect(await within(table).findByRole('cell', { name: 'Basalt Labs' })).toBeVisible();
    expect(within(table).getByRole('cell', { name: 'Free' })).toBeVisible();
    expect(within(table).getByText('Invite pending')).toBeVisible();
    expect(screen.queryByRole('dialog', { name: 'Create tenant' })).not.toBeInTheDocument();
  });

  it('resends a pending founding-admin invitation', async () => {
    server.use(
      ...signedInAs(PLATFORM_ADMIN),
      ...respondsWithPlatformTenants([pendingTenant]),
      ...resendsFoundingAdminInvite(foundingAdmin),
    );

    const { user } = await renderApp('/tenants');

    await screen.findByRole('table', { name: 'Platform tenants' });
    await user.click(screen.getByRole('button', { name: 'Actions for Aman Foundation' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Resend invite' }));

    expect(await screen.findByText('Invitation resent for Aman Foundation.')).toBeVisible();
  });

  it('states the access and job-board consequences before suspending a tenant', async () => {
    server.use(
      ...signedInAs(PLATFORM_ADMIN),
      ...respondsWithPlatformTenants([activeTenant]),
      ...setsPlatformTenantStatus({ ...activeTenant, is_active: false }),
    );

    const { user } = await renderApp('/tenants');
    const table = await screen.findByRole('table', { name: 'Platform tenants' });
    await user.click(screen.getByRole('button', { name: 'Actions for Aman Foundation' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Suspend tenant' }));

    const dialog = screen.getByRole('alertdialog', { name: 'Suspend Aman Foundation?' });
    expect(
      within(dialog).getByText(
        'Every recruiter at Aman Foundation will lose access immediately, and its jobs will leave the public job board. No tenant data will be deleted.',
      ),
    ).toBeVisible();
    await user.click(within(dialog).getByRole('button', { name: 'Suspend tenant' }));

    const row = await within(table).findByRole('row', { name: /Aman Foundation.*Suspended/ });
    expect(within(row).getByText('Suspended')).toBeVisible();
  });

  it('states what access and jobs return before restoring a tenant', async () => {
    const suspendedTenant = { ...activeTenant, is_active: false };
    server.use(
      ...signedInAs(PLATFORM_ADMIN),
      ...respondsWithPlatformTenants([suspendedTenant]),
      ...setsPlatformTenantStatus(activeTenant),
    );

    const { user } = await renderApp('/tenants');
    const table = await screen.findByRole('table', { name: 'Platform tenants' });
    await user.click(screen.getByRole('button', { name: 'Actions for Aman Foundation' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Restore tenant' }));

    const dialog = screen.getByRole('alertdialog', { name: 'Restore Aman Foundation?' });
    expect(
      within(dialog).getByText(
        'Every active recruiter at Aman Foundation will regain their previous access. Published jobs that are still current will return to the public job board.',
      ),
    ).toBeVisible();
    await user.click(within(dialog).getByRole('button', { name: 'Restore tenant' }));

    const row = await within(table).findByRole('row', { name: /Aman Foundation.*Active/ });
    expect(within(row).getByText('Active')).toBeVisible();
  });
});
