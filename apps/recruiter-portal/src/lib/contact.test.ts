import { describe, expect, it } from 'vitest';
import { readContact } from './contact';

describe('readContact', () => {
  it('builds a wa.me deep link and a mailto from the configured contact', () => {
    const contact = readContact({
      VITE_CONTACT_WHATSAPP: '963991234567',
      VITE_CONTACT_EMAIL: 'hello@sync.ngo',
    });

    expect(contact.whatsappUrl).toMatch(/^https:\/\/wa\.me\/963991234567\?text=/);
    expect(contact.emailUrl).toBe('mailto:hello@sync.ngo');
    expect(contact.email).toBe('hello@sync.ngo');
  });

  it('reduces a human-typed number to the digits wa.me expects', () => {
    const contact = readContact({ VITE_CONTACT_WHATSAPP: '+963 (99) 123-4567' });

    expect(contact.whatsappNumber).toBe('963991234567');
  });

  it('falls back to placeholders when nothing is configured, off production', () => {
    const contact = readContact({});

    expect(contact.whatsappNumber).toBe('963991234567');
    expect(contact.email).toBe('hello@sync.ngo');
  });

  it('refuses to fall back in a production build', () => {
    expect(() => readContact({}, true)).toThrow(/must be set in a production build/);
    expect(() => readContact({ VITE_CONTACT_EMAIL: 'hello@sync.ngo' }, true)).toThrow(
      /must be set in a production build/,
    );
  });

  it('rejects a number with a leading zero', () => {
    expect(() => readContact({ VITE_CONTACT_WHATSAPP: '0991234567' })).toThrow(/no leading 0/);
  });

  it('rejects a malformed email', () => {
    expect(() => readContact({ VITE_CONTACT_EMAIL: 'not-an-email' })).toThrow(/valid email/);
  });
});
