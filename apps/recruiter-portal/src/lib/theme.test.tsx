import { cleanup, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { signedOut } from '@/features/auth/testing/handlers';
import { renderApp } from '@/testing/render-app';
import { server } from '@/testing/server';
import { THEME_STORAGE_KEY } from './theme';

describe('the theme toggle', () => {
  it('restyles the whole document and survives a reload', async () => {
    server.use(...signedOut());
    const { user } = await renderApp('/login');

    await user.click(screen.getByRole('button', { name: 'Switch to dark theme' }));

    expect(document.documentElement).toHaveClass('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');

    cleanup();
    document.documentElement.className = '';
    await renderApp('/login');

    expect(document.documentElement).toHaveClass('dark');
    expect(screen.getByRole('button', { name: 'Switch to light theme' })).toBeVisible();
  });
});
