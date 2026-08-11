import { describe, expect, it } from 'vitest';
import { CONTACT_SUBJECT, contactChannels, emailHref, whatsAppHref } from './contact';

describe('the links that reach the Sync Hub team', () => {
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

describe('the contact the environment configures', () => {
  it('offers both channels when both are set, showing them as they were written', () => {
    const channels = contactChannels({ whatsapp: '+963 944 123 456', email: 'hello@sync.ngo' });

    expect(channels.whatsapp).toEqual({
      href: whatsAppHref('+963944123456'),
      label: '+963 944 123 456',
    });
    expect(channels.email).toEqual({ href: emailHref('hello@sync.ngo'), label: 'hello@sync.ngo' });
  });

  it('ignores the padding an env file picks up', () => {
    expect(contactChannels({ whatsapp: ' +963944123456 ', email: ' hello@sync.ngo ' })).toEqual({
      whatsapp: { href: whatsAppHref('+963944123456'), label: '+963944123456' },
      email: { href: emailHref('hello@sync.ngo'), label: 'hello@sync.ngo' },
    });
  });

  it('offers no channel it has not been configured with', () => {
    expect(contactChannels({ whatsapp: '', email: '' })).toEqual({ whatsapp: null, email: null });
  });

  it('withholds a channel whose value could not dial or deliver', () => {
    const channels = contactChannels({ whatsapp: '0944 123 456', email: 'hello at sync' });

    expect(channels).toEqual({ whatsapp: null, email: null });
  });

  it('keeps the channel that is usable when the other one is not', () => {
    const channels = contactChannels({ whatsapp: '+963944123456', email: 'nonsense' });

    expect(channels.whatsapp).not.toBeNull();
    expect(channels.email).toBeNull();
  });
});
