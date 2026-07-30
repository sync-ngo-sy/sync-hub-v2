import { describe, expect, it } from 'vitest';
import { safeReturnTo } from './return-to';

describe('safeReturnTo', () => {
  it('keeps a root-relative destination, search and all', () => {
    expect(safeReturnTo('/jobs?status=published')).toBe('/jobs?status=published');
  });

  it.each([
    ['https://evil.test/phish', 'an absolute URL'],
    ['//evil.test/phish', 'a protocol-relative URL'],
    ['/\\evil.test', 'a backslash-smuggled host'],
    ['jobs', 'a path with no leading slash'],
    ['', 'an empty value'],
    [undefined, 'a missing value'],
  ])('rejects %s (%s)', (value: string | undefined, _reason: string) => {
    expect(safeReturnTo(value)).toBeNull();
  });
});
