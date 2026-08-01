import { describe, expect, it } from 'vitest';
import { CONTACT_SUBJECT, emailHref, whatsAppHref } from './contact';

describe('the links that reach the Sync team', () => {
  it('deep-links WhatsApp with the digits of the configured number', () => {
    expect(whatsAppHref('+963944123456')).toContain('https://wa.me/963944123456?');
  });

  it('drops the punctuation a written number carries and wa.me rejects', () => {
    expect(whatsAppHref('+963 944-123 456')).toContain('https://wa.me/963944123456?');
  });

  it('opens WhatsApp on a message the visitor does not have to write', () => {
    expect(whatsAppHref('+963944123456')).toBe(
      `https://wa.me/963944123456?text=${encodeURIComponent(CONTACT_SUBJECT)}`,
    );
  });

  it('opens the mail client on the configured address, subject filled in', () => {
    expect(emailHref('hello@sync.ngo')).toBe(
      `mailto:hello@sync.ngo?subject=${encodeURIComponent(CONTACT_SUBJECT)}`,
    );
  });
});
