import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderApp } from '@/testing/render-app';

// The values the Vitest config injects for VITE_CONTACT_* — deliberately distinct from the code
// defaults, so asserting them proves the landing reads the env, not a hardcoded fallback.
const WHATSAPP = 'https://wa.me/963111222333';
const EMAIL = 'team@sync.test';

// The landing is public and fetches nothing, so no auth handlers are needed: with
// `onUnhandledRequest: 'error'`, a green run is itself proof it stays offline.

describe('the recruiter landing', () => {
  describe('what it says and where it routes', () => {
    it('explains Sync for employers', async () => {
      await renderApp('/');

      expect(
        await screen.findByRole('heading', { name: /meet the shortlist, not the pile/i }),
      ).toBeInTheDocument();
      expect(screen.getByText(/screens each applicant against your role/i)).toBeInTheDocument();
    });

    it('routes every "create workspace" call to workspace sign-up', async () => {
      await renderApp('/');

      const links = await screen.findAllByRole('link', { name: /workspace/i });
      expect(links.length).toBeGreaterThan(0);
      for (const link of links) {
        expect(link).toHaveAttribute('href', '/signup');
      }
    });

    it('routes every "log in" call to the login page', async () => {
      await renderApp('/');

      const links = await screen.findAllByRole('link', { name: 'Log in' });
      expect(links.length).toBeGreaterThan(0);
      for (const link of links) {
        expect(link).toHaveAttribute('href', '/login');
      }
    });

    it('navigates to workspace sign-up when a CTA is clicked', async () => {
      const { router, user } = await renderApp('/');

      await user.click(await screen.findByRole('link', { name: 'Create workspace' }));

      await waitFor(() => expect(router.state.location.pathname).toBe('/signup'));
      expect(await screen.findByText(/workspace sign-up is coming/i)).toBeInTheDocument();
    });
  });

  describe('the configured contact', () => {
    it('renders the WhatsApp deep link from env, opening in a new tab', async () => {
      await renderApp('/');

      const links = await screen.findAllByRole('link', { name: /whatsapp/i });
      expect(links.length).toBeGreaterThan(0);
      for (const link of links) {
        expect(link.getAttribute('href')).toContain(WHATSAPP);
        expect(link).toHaveAttribute('target', '_blank');
        expect(link).toHaveAttribute('rel', 'noreferrer');
      }
    });

    it('prefills the WhatsApp opener for the visitor', async () => {
      await renderApp('/');

      const links = await screen.findAllByRole('link', { name: /whatsapp/i });
      const href = links[0]?.getAttribute('href') ?? '';
      expect(href).toContain('?text=');
      expect(decodeURIComponent(href)).toContain('set up a workspace');
    });

    it('renders the email link from env as a mailto', async () => {
      await renderApp('/');

      const address = await screen.findByRole('link', { name: EMAIL });
      expect(address).toHaveAttribute('href', `mailto:${EMAIL}`);
      expect(screen.getByRole('link', { name: /email us/i })).toHaveAttribute(
        'href',
        `mailto:${EMAIL}`,
      );
    });
  });
});
