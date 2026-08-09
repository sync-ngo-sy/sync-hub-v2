import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { faultsOnSession, signedInAs, signedOut } from '@/features/auth/testing/handlers';
import { CONTACT_SUBJECT } from '@/features/landing/contact';
import { HEADLINE_TEXT } from '@/features/landing/headline';
import { env } from '@/lib/env';
import { CANDIDATE, RECRUITER, SERVER_FAULT } from '@/testing/fixtures';
import { renderApp } from '@/testing/render-app';
import { server } from '@/testing/server';

const whatsApp = `https://wa.me/963944123456?text=${encodeURIComponent(CONTACT_SUBJECT)}`;
const email = `mailto:${env.contact.email}?subject=${encodeURIComponent(CONTACT_SUBJECT)}`;

function hrefsOf(links: HTMLElement[]): (string | null)[] {
  return links.map((link) => link.getAttribute('href'));
}

describe('the recruiter landing', () => {
  it('explains Sync Hub to a company and asks for access rather than offering a workspace', async () => {
    await renderApp('/');

    expect(
      await screen.findByRole('heading', { level: 1, name: HEADLINE_TEXT }),
    ).toBeInTheDocument();

    const page = screen.getByRole('main');
    expect(hrefsOf(within(page).getAllByRole('link', { name: /Request access/ }))).toEqual([
      '/request-access',
      '/request-access',
    ]);
    expect(within(page).queryByRole('link', { name: /workspace/i })).not.toBeInTheDocument();
    expect(hrefsOf(within(page).getAllByRole('link', { name: 'Sign in' }))).toEqual([
      '/login',
      '/login',
    ]);

    const header = screen.getByRole('banner');
    expect(within(header).getByRole('link', { name: 'Request access' })).toHaveAttribute(
      'href',
      '/request-access',
    );
    expect(within(header).getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
  });

  it('names what a workspace does for an employer, and how hiring on it goes', async () => {
    await renderApp('/');

    const capabilities = await screen.findByRole('region', {
      name: 'A hiring workspace, not another inbox.',
    });
    expect(within(capabilities).getAllByRole('heading', { level: 3 })).toHaveLength(4);

    const steps = screen.getByRole('region', { name: 'Three steps to your first hire.' });
    expect(
      within(steps)
        .getAllByRole('listitem')
        .map((step) => within(step).getByRole('heading', { level: 3 }).textContent),
    ).toEqual(['Ask for access', 'Publish a job with its criteria', 'Work the pipeline']);
  });

  it('reaches the Sync Hub team on the one WhatsApp number and address it is configured with', async () => {
    await renderApp('/');

    const band = await screen.findByRole('region', { name: 'Start hiring on Sync Hub.' });

    const whatsAppLink = within(band).getByRole('link', { name: /^WhatsApp/ });
    expect(whatsAppLink).toHaveAttribute('href', whatsApp);
    expect(whatsAppLink).toHaveAccessibleName(`WhatsApp ${env.contact.whatsapp}`);
    expect(whatsAppLink).toHaveAttribute('target', '_blank');

    const emailLink = within(band).getByRole('link', { name: /^Email/ });
    expect(emailLink).toHaveAttribute('href', email);
    expect(emailLink).toHaveAccessibleName(`Email ${env.contact.email}`);
  });

  it('repeats the access and contact links in the footer', async () => {
    await renderApp('/');

    const footer = await screen.findByRole('contentinfo');

    expect(within(footer).getByRole('link', { name: 'Request access' })).toHaveAttribute(
      'href',
      '/request-access',
    );
    expect(within(footer).getByRole('link', { name: /^WhatsApp/ })).toHaveAttribute(
      'href',
      whatsApp,
    );
    expect(within(footer).getByRole('link', { name: /^Email/ })).toHaveAttribute('href', email);
  });

  it('holds the page sections and the access ask behind the menu button a phone header shows', async () => {
    const { user } = await renderApp('/');
    await user.click(screen.getByRole('button', { name: 'Open menu' }));

    const menu = await screen.findByRole('dialog');
    expect(within(menu).getByRole('link', { name: 'What you get' })).toHaveAttribute(
      'href',
      '#what-you-get',
    );
    expect(within(menu).getByRole('link', { name: 'How it works' })).toHaveAttribute(
      'href',
      '#how-it-works',
    );
    expect(within(menu).getByRole('link', { name: 'Contact' })).toHaveAttribute('href', '#contact');
    expect(within(menu).getByRole('link', { name: 'Request access' })).toHaveAttribute(
      'href',
      '/request-access',
    );
  });

  it('titles itself for a search result rather than for the app chrome', async () => {
    await renderApp('/');

    expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(document.title).toBe(`Sync Hub Recruiter — ${HEADLINE_TEXT}`);
  });
});

describe('the landing page and a session', () => {
  it('shows a signed-out visitor the landing page, with a logo that keeps them there', async () => {
    server.use(...signedOut());

    const { router } = await renderApp('/');

    expect(await screen.findByRole('heading', { level: 1, name: HEADLINE_TEXT })).toBeVisible();
    expect(router.state.location.pathname).toBe('/');
    expect(
      within(screen.getByRole('banner')).getByRole('link', { name: 'Sync Hub' }),
    ).toHaveAttribute('href', '/');
  });

  it('sends a signed-in recruiter to the dashboard instead of the landing page', async () => {
    server.use(...signedInAs(RECRUITER));

    const { router } = await renderApp('/');

    expect(router.state.location.pathname).toBe('/dashboard');
    expect(screen.queryByRole('heading', { level: 1, name: HEADLINE_TEXT })).toBeNull();
  });

  it('sends a signed-in candidate to the wrong-portal notice, not the landing page', async () => {
    server.use(...signedInAs(CANDIDATE));

    const { router } = await renderApp('/');

    expect(router.state.location.pathname).toBe('/wrong-portal');
  });

  it('still shows the landing page when the session cannot be read at all', async () => {
    server.use(...faultsOnSession(SERVER_FAULT));

    const { router } = await renderApp('/');

    expect(await screen.findByRole('heading', { level: 1, name: HEADLINE_TEXT })).toBeVisible();
    expect(router.state.location.pathname).toBe('/');
  });
});
