import { describe, expect, it } from 'vitest';
import { browseQuery, isFiltered, jobFiltersSchema, MAX_KEYWORDS } from './filters';

describe('jobFiltersSchema', () => {
  it('reads the three filters a link can carry', () => {
    expect(
      jobFiltersSchema.parse({ q: 'coordinator', location: 'sy-aleppo', type: 'contract' }),
    ).toEqual({ q: 'coordinator', location: 'sy-aleppo', type: 'contract' });
  });

  it('holds nothing when the address bar carries nothing', () => {
    expect(jobFiltersSchema.parse({})).toEqual({});
  });

  it('reads a blank as no filter, so a cleared box never narrows anything', () => {
    expect(jobFiltersSchema.parse({ q: '   ', location: '' })).toEqual({});
  });

  it('trims the keyword it was handed', () => {
    expect(jobFiltersSchema.parse({ q: '  nurse  ' })).toEqual({ q: 'nurse' });
  });

  it('drops an employment type the platform does not have rather than failing the page', () => {
    expect(jobFiltersSchema.parse({ type: 'apprenticeship', location: 'sy-homs' })).toEqual({
      location: 'sy-homs',
    });
  });

  it('drops a keyword longer than the API would accept', () => {
    expect(jobFiltersSchema.parse({ q: 'a'.repeat(MAX_KEYWORDS + 1) })).toEqual({});
  });
});

describe('isFiltered', () => {
  it('is false only when none of the three is set', () => {
    expect(isFiltered({})).toBe(false);
    expect(isFiltered({ q: 'nurse' })).toBe(true);
    expect(isFiltered({ location: 'sy-aleppo' })).toBe(true);
    expect(isFiltered({ type: 'volunteer' })).toBe(true);
  });
});

describe('browseQuery', () => {
  it('names the three the way the wire does, leaving an unset one absent', () => {
    expect(browseQuery({ q: 'nurse', location: 'sy-aleppo' })).toEqual({
      q: 'nurse',
      location_key: 'sy-aleppo',
      employment_type: undefined,
    });
  });
});
