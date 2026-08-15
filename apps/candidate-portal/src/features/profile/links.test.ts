import { describe, expect, it } from 'vitest';
import { githubAddress, linkedinAddress, MAX_LINK, portfolioAddress } from './links';

describe('a LinkedIn address', () => {
  it.each([
    'https://www.linkedin.com/in/amina-haddad',
    'http://www.linkedin.com/in/amina-haddad',
    'https://linkedin.com/in/amina-haddad/',
    'https://sy.linkedin.com/in/amina-haddad',
    'linkedin.com/in/amina-haddad',
    '  linkedin.com/in/amina-haddad  ',
    'https://www.linkedin.com/in/amina-haddad?trk=public_profile#about',
  ])('is one address however it was written: %s', (typed) => {
    expect(linkedinAddress(typed)).toBe('https://www.linkedin.com/in/amina-haddad');
  });

  it.each(['amina-haddad', '@amina-haddad', 'in/amina-haddad'])(
    'is completed from the handle alone: %s',
    (typed) => {
      expect(linkedinAddress(typed)).toBe('https://www.linkedin.com/in/amina-haddad');
    },
  );

  it.each([
    'https://www.linkedin.com/company/aman-relief',
    'https://www.linkedin.com/in/amina/details/experience',
    'https://github.com/amina-haddad',
    'amina-haddad.dev',
    'amina haddad',
    '',
  ])('is not what somebody typed here: %s', (typed) => {
    expect(linkedinAddress(typed)).toBeNull();
  });
});

describe('a GitHub address', () => {
  it.each([
    'https://github.com/amina-haddad',
    'https://www.github.com/amina-haddad',
    'github.com/amina-haddad/',
    'amina-haddad',
    '@amina-haddad',
  ])('is one address however it was written: %s', (typed) => {
    expect(githubAddress(typed)).toBe('https://github.com/amina-haddad');
  });

  it('is the account a repository belongs to', () => {
    expect(githubAddress('https://github.com/amina-haddad/ledger')).toBe(
      'https://github.com/amina-haddad',
    );
  });

  it.each(['https://gitlab.com/amina-haddad', 'https://github.com', 'amina-haddad.dev', ''])(
    'is not what somebody typed here: %s',
    (typed) => {
      expect(githubAddress(typed)).toBeNull();
    },
  );
});

describe('a portfolio address', () => {
  it.each([
    ['amina-haddad.dev', 'https://amina-haddad.dev'],
    ['https://amina-haddad.dev/', 'https://amina-haddad.dev'],
    ['HTTPS://Amina-Haddad.DEV/Work', 'https://amina-haddad.dev/Work'],
    ['http://amina-haddad.dev', 'http://amina-haddad.dev'],
    ['https://amina-haddad.dev/work?year=2026', 'https://amina-haddad.dev/work?year=2026'],
    ['https://amina-haddad.dev//', 'https://amina-haddad.dev'],
  ])('is stored as a browser would open it: %s', (typed, stored) => {
    expect(portfolioAddress(typed)).toBe(stored);
  });

  it.each(['https://amina@amina-haddad.dev', 'https://amina:secret@amina-haddad.dev'])(
    'is not an address carrying somebody’s credentials: %s',
    (typed) => {
      expect(portfolioAddress(typed)).toBeNull();
    },
  );

  it.each([
    'javascript:alert(1)',
    'mailto:amina@example.com',
    'ftp://files.example.com',
    'amina-haddad',
    'amina haddad.dev',
    '',
  ])('is not somewhere a browser could open: %s', (typed) => {
    expect(portfolioAddress(typed)).toBeNull();
  });

  it('is refused rather than cut when it is longer than the column', () => {
    expect(portfolioAddress(`https://amina-haddad.dev/${'x'.repeat(MAX_LINK)}`)).toBeNull();
  });
});
