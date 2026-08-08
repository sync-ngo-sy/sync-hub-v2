import { describe, expect, it } from 'vitest';
import {
  type CandidateSearchFilters,
  hardFilterCount,
  isAsked,
  noMatchesMessage,
  searchQuery,
} from './search';

const ASKED: CandidateSearchFilters = { q: 'backend engineer' };

describe('whether the search has been asked anything', () => {
  it('waits until there are words to search on', () => {
    expect(isAsked({ q: '' })).toBe(false);
    expect(isAsked({ q: 'a' })).toBe(false);
    expect(isAsked({ q: 'ab' })).toBe(true);
  });

  it('does not count the spaces around the words', () => {
    expect(isAsked({ q: '  a  ' })).toBe(false);
    expect(isAsked({ q: '  nurse  ' })).toBe(true);
  });
});

describe('what the API is asked for', () => {
  it('sends the words without the spaces a Recruiter typed around them', () => {
    expect(searchQuery({ q: '  backend engineer  ' }).q).toBe('backend engineer');
  });

  it('sends each hard filter under the name the API knows it by', () => {
    expect(
      searchQuery({
        q: 'nurse',
        location: 'sy-aleppo',
        languages: ['ar', 'en'],
        keywords: 'triage',
      }),
    ).toEqual({
      q: 'nurse',
      location_key: 'sy-aleppo',
      language: ['ar', 'en'],
      keywords: 'triage',
      limit: 20,
    });
  });

  it('leaves an unset filter out rather than sending it empty', () => {
    expect(searchQuery({ q: 'nurse', location: '', languages: [], keywords: '   ' })).toEqual({
      q: 'nurse',
      location_key: undefined,
      language: undefined,
      keywords: undefined,
      limit: 20,
    });
  });
});

describe('how many hard filters are narrowing the results', () => {
  it('counts the filters, never the words themselves', () => {
    expect(hardFilterCount(ASKED)).toBe(0);
    expect(hardFilterCount({ ...ASKED, location: 'sy-aleppo' })).toBe(1);
    expect(hardFilterCount({ ...ASKED, location: 'sy-aleppo', languages: ['ar'] })).toBe(2);
    expect(hardFilterCount({ ...ASKED, languages: ['ar', 'en', 'fr'] })).toBe(1);
    expect(hardFilterCount({ ...ASKED, languages: [] })).toBe(0);
    expect(hardFilterCount({ ...ASKED, location: '', keywords: 'triage' })).toBe(1);
  });
});

describe('what a search with no matches says', () => {
  it('blames the words when nothing else was narrowing them', () => {
    expect(noMatchesMessage(ASKED)).toBe(
      'No Searchable Candidate matches those words. Plainer words reach more people.',
    );
  });

  it('names the filter as the thing to loosen when there is one', () => {
    expect(noMatchesMessage({ ...ASKED, languages: ['ar'] })).toBe(
      'No Searchable Candidate matches those words with that filter.',
    );
  });

  it('speaks of them in the plural when there are several', () => {
    expect(noMatchesMessage({ ...ASKED, languages: ['ar'], keywords: 'triage' })).toBe(
      'No Searchable Candidate matches those words with those filters.',
    );
  });
});
