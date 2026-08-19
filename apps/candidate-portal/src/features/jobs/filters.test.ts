import { describe, expect, it } from 'vitest';
import { browseQuery, isFiltered, jobFiltersSchema, MAX_KEYWORD_LENGTH } from './filters';

describe('jobFiltersSchema', () => {
  it('reads the four filters a link can carry', () => {
    expect(
      jobFiltersSchema.parse({
        q: 'coordinator',
        location: 'sy-aleppo',
        type: 'contract',
        mode: 'hybrid',
      }),
    ).toEqual({ q: 'coordinator', location: 'sy-aleppo', type: 'contract', mode: 'hybrid' });
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

  it('drops a work mode the platform does not have rather than failing the page', () => {
    expect(jobFiltersSchema.parse({ mode: 'field', location: 'sy-homs' })).toEqual({
      location: 'sy-homs',
    });
  });

  it('drops a keyword longer than the API would accept', () => {
    expect(jobFiltersSchema.parse({ q: 'a'.repeat(MAX_KEYWORD_LENGTH + 1) })).toEqual({});
  });
});

describe('isFiltered', () => {
  it('is false only when none of the four is set', () => {
    expect(isFiltered({})).toBe(false);
    expect(isFiltered({ q: 'nurse' })).toBe(true);
    expect(isFiltered({ location: 'sy-aleppo' })).toBe(true);
    expect(isFiltered({ type: 'volunteer' })).toBe(true);
    expect(isFiltered({ mode: 'remote' })).toBe(true);
  });
});

describe('browseQuery', () => {
  it('names the four the way the wire does, leaving an unset one absent', () => {
    expect(browseQuery({ q: 'nurse', location: 'sy-aleppo', mode: 'remote' })).toEqual({
      q: 'nurse',
      location_key: 'sy-aleppo',
      employment_type: undefined,
      work_mode: 'remote',
    });
  });
});
