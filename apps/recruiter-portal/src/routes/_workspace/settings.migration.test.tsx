import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { signedInAs } from '@/features/auth/testing/handlers';
import { servesManatalMigration } from '@/features/manatal-migration/testing/handlers';
import { PARTWAY_THROUGH } from '@/features/manatal-migration/testing/fixtures';
import { listsMembers } from '@/features/team/testing/handlers';
import { RANA } from '@/features/team/testing/fixtures';
import { RECRUITER } from '@/testing/fixtures';
import { renderApp } from '@/testing/render-app';
import { server } from '@/testing/server';

describe('Manatal import settings', () => {
  it('shows progress for a tenant admin on the Manatal import tab', async () => {
    server.use(
      ...signedInAs(RECRUITER),
      ...listsMembers([RANA]),
      ...servesManatalMigration(PARTWAY_THROUGH),
    );

    await renderApp('/settings?tab=migration');

    expect(await screen.findByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
    const tabs = within(screen.getByRole('tablist', { name: 'Workspace settings' }));
    expect(tabs.getByRole('tab', { name: 'Manatal import' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(await screen.findByText('8 of 12 imported profiles are published and searchable.')).toBeVisible();
    expect(screen.getByText('Amina Haddad')).toBeVisible();
  });
});
