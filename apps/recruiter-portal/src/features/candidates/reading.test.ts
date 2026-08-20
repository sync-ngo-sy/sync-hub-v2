import { describe, expect, it } from 'vitest';
import {
  type CandidatesReading,
  candidatesAddress,
  candidatesReading,
  languagesFrom,
  languageTokens,
  orderIn,
  tabIn,
} from './reading';

function read(address: unknown): CandidatesReading {
  return candidatesReading.parse(address);
}

describe('reading an address back', () => {
  it('keeps only an order the directory offers, and falls back to the newest', () => {
    expect(orderIn(read({ sort: 'most_experience' }))).toBe('most_experience');
    expect(orderIn(read({ sort: 'name_reversed' }))).toBe('name_reversed');
    expect(orderIn(read({ sort: 'cheapest' }))).toBe('newest');
    expect(orderIn(read({}))).toBe('newest');
  });

  it('opens the tab that was asked for', () => {
    expect(tabIn(read({ tab: 'search' }))).toBe('search');
    expect(tabIn(read({ tab: 'filter', q: 'nurse' }))).toBe('filter');
  });

  it('reads a link that predates the tabs, or names no tab of ours, by what it carries', () => {
    expect(tabIn(read({ q: 'nurse' }))).toBe('search');
    expect(tabIn(read({}))).toBe('filter');
    expect(tabIn(read({ q: '   ' }))).toBe('filter');
    expect(tabIn(read({ tab: 'directory', q: 'nurse' }))).toBe('search');
  });
});

describe('writing a Reading back into an address', () => {
  it('writes every filter under the name it came in as', () => {
    expect(
      candidatesAddress({
        q: 'nurse',
        location: 'sy-aleppo',
        languages: ['ar'],
        skills: ['React'],
        role: 'frontend-engineer',
        experience: 5,
        keywords: 'triage',
      }),
    ).toMatchObject({
      q: 'nurse',
      location: 'sy-aleppo',
      languages: ['ar'],
      skills: ['React'],
      role: 'frontend-engineer',
      experience: 5,
      keywords: 'triage',
    });
  });

  it('leaves an unset filter out rather than writing it empty', () => {
    expect(
      candidatesAddress({ q: '  ', location: '', languages: [], skills: [], experience: 0 }),
    ).toEqual({
      tab: 'filter',
      sort: undefined,
      q: undefined,
      location: undefined,
      languages: undefined,
      skills: undefined,
      role: undefined,
      experience: undefined,
      keywords: undefined,
    });
  });

  it('names the tab it was read on, so a link out of the page opens on that tab', () => {
    expect(candidatesAddress({ tab: 'filter', q: 'nurse' }).tab).toBe('filter');
    expect(candidatesAddress({ tab: 'search' }).tab).toBe('search');
  });

  it('names the tab the words imply where the Reading itself names none', () => {
    expect(candidatesAddress({ q: 'nurse' }).tab).toBe('search');
    expect(candidatesAddress({}).tab).toBe('filter');
  });

  it('carries the order the directory was left in, and leaves the default one out', () => {
    expect(candidatesAddress({ tab: 'filter', sort: 'name' }).sort).toBe('name');
    expect(candidatesAddress({ tab: 'filter', sort: 'newest' }).sort).toBeUndefined();
    expect(candidatesAddress({ tab: 'filter' }).sort).toBeUndefined();
  });

  it('writes no order for a ranking, which is ordered by closeness and nothing else', () => {
    expect(candidatesAddress({ tab: 'search', q: 'nurse', sort: 'name' }).sort).toBeUndefined();
  });

  it('hands back the tab and the order it was written from', () => {
    const left: CandidatesReading = { tab: 'filter', sort: 'name', q: 'nurse', role: 'nurse' };

    const reopened = read(candidatesAddress(left));

    expect(tabIn(reopened)).toBe('filter');
    expect(orderIn(reopened)).toBe('name');
    expect(reopened.role).toBe('nurse');
  });
});

describe('a language and the least proficiency that will do', () => {
  it('reads a bare code as any level', () => {
    expect(languagesFrom(['ar'])).toEqual([{ code: 'ar', level: '' }]);
  });

  it('reads the level written after the colon', () => {
    expect(languagesFrom(['ar:native', 'en:intermediate'])).toEqual([
      { code: 'ar', level: 'native' },
      { code: 'en', level: 'intermediate' },
    ]);
  });

  it('writes a level back only where one was asked for', () => {
    expect(
      languageTokens([
        { code: 'ar', level: 'native' },
        { code: 'en', level: '' },
      ]),
    ).toEqual(['ar:native', 'en']);
  });

  it('drops a row that names no language at all', () => {
    expect(languageTokens([{ code: '', level: 'native' }])).toEqual([]);
  });

  it('survives a round trip', () => {
    const tokens = ['ar:native', 'en'];
    expect(languageTokens(languagesFrom(tokens))).toEqual(tokens);
  });
});
