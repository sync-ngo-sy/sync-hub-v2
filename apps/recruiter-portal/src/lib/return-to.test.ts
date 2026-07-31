import { describe, expect, it } from 'vitest';
import { resolveReturnTo } from './return-to';

describe('resolveReturnTo', () => {
  it('keeps a destination inside this portal, query string and all', () => {
    expect(resolveReturnTo('/jobs?status=published')).toBe('/jobs?status=published');
  });

  it('refuses an off-site absolute URL', () => {
    expect(resolveReturnTo('https://evil.test/steal')).toBeNull();
  });

  it('refuses a protocol-relative URL, which a browser would follow off-site', () => {
    expect(resolveReturnTo('//evil.test/steal')).toBeNull();
  });

  it('refuses a backslash-disguised host', () => {
    expect(resolveReturnTo('/\\evil.test/steal')).toBeNull();
  });

  it('has nothing to return to when the search param is absent or empty', () => {
    expect(resolveReturnTo(undefined)).toBeNull();
    expect(resolveReturnTo('')).toBeNull();
  });
});
