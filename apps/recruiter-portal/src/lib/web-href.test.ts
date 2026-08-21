import { describe, expect, it } from 'vitest';
import { webHref } from './web-href';

describe('webHref', () => {
  it('keeps an https address, query string and all', () => {
    expect(webHref('https://github.com/amina-haddad/atlas?tab=readme')).toBe(
      'https://github.com/amina-haddad/atlas?tab=readme',
    );
  });

  it('keeps a plain http address', () => {
    expect(webHref('http://amina-haddad.dev')).toBe('http://amina-haddad.dev');
  });

  it('refuses a javascript: URL a browser would execute', () => {
    expect(webHref('javascript:alert(1)')).toBeNull();
  });

  it('refuses data: and vbscript: schemes', () => {
    expect(webHref('data:text/html,<script>alert(1)</script>')).toBeNull();
    expect(webHref('vbscript:msgbox(1)')).toBeNull();
  });

  it('refuses text that is not a URL at all', () => {
    expect(webHref('amina-haddad.dev')).toBeNull();
    expect(webHref('')).toBeNull();
  });
});
