import { screen, waitFor } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { signedInAs } from '@/features/auth/testing/handlers';
import { OMAR, RANA } from '@/features/team/testing/fixtures';
import { failsToListMembers, listsMembers } from '@/features/team/testing/handlers';
import { belongsToTenant, refusesLogo, savesLogo } from '@/features/tenant/testing/handlers';
import { AMAN, RECRUITER, SERVER_FAULT } from '@/testing/fixtures';
import { renderApp } from '@/testing/render-app';
import { server } from '@/testing/server';

const A_LOGO_URL = 'http://sync.test/storage/v1/object/public/tenant-logos/aman/logo.webp';

const LOGO_TOO_LARGE = {
  type: 'urn:sync:problem:tenant-logo-too-large',
  title: 'Content Too Large',
  status: 413,
  detail: 'A logo has to be 5 MB or smaller. Crop it or pick a smaller JPEG, PNG or WebP file.',
};

function aLogoFile(name = 'logo.png', type = 'image/png', size = 4_000) {
  return new File([new Uint8Array(size)], name, { type });
}

function pickALogo(user: UserEvent, file = aLogoFile()) {
  return user.upload(screen.getByLabelText('Choose a logo'), file);
}

function theLogo(): HTMLImageElement | null {
  return document.querySelector('[data-slot="tenant-logo"] img');
}

async function openTheTenantTab(members = [RANA, OMAR]) {
  server.use(...signedInAs(RECRUITER), ...listsMembers(members));
  await renderApp('/settings?tab=tenant');
  await screen.findByText('Aman Relief');
  return userEvent.setup({ applyAccept: false });
}

describe('the Tenant logo', () => {
  it('stands for the Tenant by its letters until an admin uploads one', async () => {
    server.use(...belongsToTenant(AMAN));

    await openTheTenantTab();

    expect(screen.getByText('AR')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Add a logo' })).toBeVisible();
  });

  it('shows the one the Tenant already has', async () => {
    server.use(...belongsToTenant({ ...AMAN, logo_url: A_LOGO_URL }));

    await openTheTenantTab();

    expect(theLogo()).toHaveAttribute('src', A_LOGO_URL);
    expect(screen.getByRole('button', { name: 'Change logo' })).toBeVisible();
  });

  it('uploads what the admin picked and shows it straight away', async () => {
    const uploaded = vi.fn();
    server.use(...savesLogo(AMAN, A_LOGO_URL, uploaded));
    const user = await openTheTenantTab();

    await pickALogo(user);

    await waitFor(() => expect(uploaded).toHaveBeenCalledTimes(1));
    expect(uploaded).toHaveBeenCalledWith(expect.stringMatching(/^multipart\/form-data/));
    await waitFor(() => expect(theLogo()).toHaveAttribute('src', A_LOGO_URL));
  });

  it('says so in place when the platform refuses the logo', async () => {
    server.use(...belongsToTenant(AMAN), ...refusesLogo(LOGO_TOO_LARGE, 413));
    const user = await openTheTenantTab();

    await pickALogo(user);

    expect(await screen.findByText(LOGO_TOO_LARGE.detail)).toBeVisible();
  });

  it('refuses a file that is not a picture without sending anything', async () => {
    const uploaded = vi.fn();
    server.use(...savesLogo(AMAN, A_LOGO_URL, uploaded));
    const user = await openTheTenantTab();

    await pickALogo(user, aLogoFile('brochure.pdf', 'application/pdf'));

    expect(await screen.findByText('A logo has to be a JPEG, PNG or WebP image.')).toBeVisible();
    expect(uploaded).not.toHaveBeenCalled();
  });

  it('is an admin’s to set — a Recruiter reads it and is told whose it is', async () => {
    server.use(...belongsToTenant({ ...AMAN, logo_url: A_LOGO_URL }));

    await openTheTenantTab([{ ...RANA, role: 'recruiter' }, OMAR]);

    expect(theLogo()).toHaveAttribute('src', A_LOGO_URL);
    expect(screen.queryByRole('button', { name: 'Change logo' })).not.toBeInTheDocument();
    expect(
      screen.getByText('Ask one of your admins to upload it, and it appears here.'),
    ).toBeVisible();
  });

  it('offers the picker when the roster cannot be read, and lets the API be the gate', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...belongsToTenant(AMAN),
      ...failsToListMembers(SERVER_FAULT),
    );

    await renderApp('/settings?tab=tenant');
    await screen.findByText('Aman Relief');

    expect(await screen.findByRole('button', { name: 'Add a logo' })).toBeVisible();
  });
});
