import { describe, expect, it } from 'vitest';
import { suggestedSlug } from './access-request';

describe('suggesting a tenant address from the company that asked', () => {
  it('lowercases and hyphenates a plain company name', () => {
    expect(suggestedSlug('Aman Relief')).toBe('aman-relief');
  });

  it('drops punctuation rather than smuggling it into the address', () => {
    expect(suggestedSlug('Basalt Labs, Inc.')).toBe('basalt-labs-inc');
    expect(suggestedSlug('  Cedar   Works  ')).toBe('cedar-works');
  });

  it('suggests nothing when the name has no address in it', () => {
    expect(suggestedSlug('مؤسسة أمان')).toBe('');
    expect(suggestedSlug('!')).toBe('');
    expect(suggestedSlug('X')).toBe('');
  });

  it('stays inside the length the API accepts, without a trailing hyphen', () => {
    const suggestion = suggestedSlug(`${'a'.repeat(62)} b`);

    expect(suggestion).toBe('a'.repeat(62));
    expect(suggestion.length).toBeLessThanOrEqual(63);
  });
});
