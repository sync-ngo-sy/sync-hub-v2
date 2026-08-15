import { describe, expect, it } from 'vitest';
import { detect, isPhoneCountry, national, PHONE_COUNTRIES, read, readable } from './phone';

const DAMASCUS = { country: 'SY', number: '+963115550134' };

describe('read', () => {
  it.each(['011 555 0134', '0115550134', '(011) 555-0134', '+963 11 555 0134', '+963115550134'])(
    'stores %s the one way',
    (typed) => {
      expect(read(typed, 'SY')).toEqual(DAMASCUS);
    },
  );

  it('says which country an international number belongs to when nobody said', () => {
    expect(read('+963115550134')).toEqual(DAMASCUS);
  });

  it('refuses a national number nobody said the country of', () => {
    expect(read('0115550134')).toBeNull();
  });

  it('refuses a number the chosen country cannot dial', () => {
    expect(read('+1 213 373 4253', 'CA')).toBeNull();
  });

  it('keeps a country that shares its calling code with twenty others', () => {
    expect(read('+1 604 559 5000', 'CA')).toEqual({ country: 'CA', number: '+16045595000' });
  });

  it.each(['', '   ', 'call me', '+', '+963 11'])('refuses %s', (typed) => {
    expect(read(typed, 'SY')).toBeNull();
  });
});

describe('detect', () => {
  it('reads the country off a pasted international number and leaves the national part', () => {
    expect(detect('+963 11 555 0134')).toEqual({ country: 'SY', national: '115550134' });
  });

  it('reads a dial code on its own, which leaves nothing behind', () => {
    expect(detect('+963')).toEqual({ country: 'SY', national: '' });
  });

  it('reads the international prefix somebody dialled instead of a plus', () => {
    expect(detect('00963115550134')).toEqual({ country: 'SY', national: '115550134' });
  });

  it('leaves a national number alone, whatever country it resembles', () => {
    expect(detect('0115550134')).toBeNull();
  });

  it('waits for a calling code that names no country on its own', () => {
    expect(detect('+1')).toBeNull();
  });
});

describe('the country list', () => {
  it('runs alphabetically by name rather than by code', () => {
    const names = PHONE_COUNTRIES.map((entry) => entry.name);
    expect(names).toEqual([...names].sort((one, other) => one.localeCompare(other)));
  });

  it('names a country and its calling code', () => {
    expect(PHONE_COUNTRIES).toContainEqual({ code: 'SY', name: 'Syria', callingCode: '963' });
  });

  it('knows a country code from anything else', () => {
    expect(isPhoneCountry('SY')).toBe(true);
    expect(isPhoneCountry('sy')).toBe(false);
    expect(isPhoneCountry('Syria')).toBe(false);
  });
});

describe('reading a stored number back', () => {
  it('writes the national part the way the country writes it', () => {
    expect(national('+963115550134')).toBe('011 555 0134');
  });

  it('separates the calling code from the number for anyone reading it', () => {
    expect(readable('+963115550134')).toBe('+963 11 555 0134');
  });

  it('hands back what it was given when that is not a number', () => {
    expect(readable('reach me at the office')).toBe('reach me at the office');
  });
});
