import { describe, expect, it } from 'vitest';
import type { CandidateSearchFilters } from './reading';
import {
  directoryQuery,
  hardFilterCount,
  isAsked,
  noCandidatesMessage,
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
        languages: ['ar:native', 'en'],
        skills: ['React', 'TypeScript'],
        role: 'frontend-engineer',
        experience: 5,
        keywords: 'triage',
      }),
    ).toEqual({
      q: 'nurse',
      location_key: 'sy-aleppo',
      language: ['ar:native', 'en'],
      skill: ['React', 'TypeScript'],
      role: 'frontend-engineer',
      min_total_experience: 5,
      keywords: 'triage',
      limit: 20,
    });
  });

  it('leaves an unset filter out rather than sending it empty', () => {
    expect(
      searchQuery({ q: 'nurse', location: '', languages: [], skills: [], keywords: '   ' }),
    ).toEqual({
      q: 'nurse',
      location_key: undefined,
      language: undefined,
      skill: undefined,
      role: undefined,
      min_total_experience: undefined,
      keywords: undefined,
      limit: 20,
    });
  });

  it('drops a number of years nobody could have worked, rather than asking for it', () => {
    expect(searchQuery({ q: 'nurse', experience: 0 }).min_total_experience).toBeUndefined();
    expect(searchQuery({ q: 'nurse', experience: -3 }).min_total_experience).toBeUndefined();
    expect(searchQuery({ q: 'nurse', experience: 101 }).min_total_experience).toBeUndefined();
    expect(searchQuery({ q: 'nurse', experience: 4.7 }).min_total_experience).toBe(4);
  });
});

describe('what the directory is asked for', () => {
  it('sends the same hard filters, and the order, and no words at all', () => {
    expect(
      directoryQuery({
        q: 'ignored',
        location: 'sy-aleppo',
        languages: ['ar:native'],
        skills: ['React'],
        role: 'frontend-engineer',
        experience: 5,
        keywords: 'also ignored',
        sort: 'name',
      }),
    ).toEqual({
      location_key: 'sy-aleppo',
      language: ['ar:native'],
      skill: ['React'],
      role: 'frontend-engineer',
      min_total_experience: 5,
      sort: 'name',
      limit: 20,
    });
  });
});

describe('how many hard filters are narrowing the results', () => {
  it('counts the filters, never the words themselves', () => {
    expect(hardFilterCount(ASKED)).toBe(0);
    expect(hardFilterCount({ ...ASKED, location: 'sy-aleppo' })).toBe(1);
    expect(hardFilterCount({ ...ASKED, location: 'sy-aleppo', languages: ['ar'] })).toBe(2);
    expect(hardFilterCount({ ...ASKED, languages: ['ar:native', 'en', 'fr'] })).toBe(1);
    expect(hardFilterCount({ ...ASKED, languages: [] })).toBe(0);
    expect(hardFilterCount({ ...ASKED, location: '', keywords: 'triage' })).toBe(1);
  });

  it('counts each of the new filters once', () => {
    expect(hardFilterCount({ ...ASKED, skills: ['React', 'TypeScript'] })).toBe(1);
    expect(hardFilterCount({ ...ASKED, role: 'frontend-engineer' })).toBe(1);
    expect(hardFilterCount({ ...ASKED, experience: 5 })).toBe(1);
    expect(hardFilterCount({ ...ASKED, skills: [], role: '', experience: 0 })).toBe(0);
  });
});

describe('what the directory with nothing in it says', () => {
  it('says the platform is empty when no filter is narrowing anything', () => {
    expect(noCandidatesMessage({ q: '' })).toBe(
      'No Candidate on the platform has opted into being found yet.',
    );
  });

  it('names the filter to loosen, and speaks of several in the plural', () => {
    expect(noCandidatesMessage({ q: '', role: 'frontend-engineer' })).toBe(
      'No Searchable Candidate matches that filter.',
    );
    expect(noCandidatesMessage({ q: '', role: 'frontend-engineer', experience: 5 })).toBe(
      'No Searchable Candidate matches all of those filters.',
    );
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
