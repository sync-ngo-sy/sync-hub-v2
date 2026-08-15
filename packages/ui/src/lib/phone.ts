// `libphonenumber-js/max` rather than the default: the smaller metadata accepts numbers Google's
// full rules refuse, and the API runs the full rules. A field that took one would hand back a
// refusal for a number it had just accepted.
import {
  AsYouType,
  type CountryCode,
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
} from 'libphonenumber-js/max';

export type PhoneCountry = CountryCode;

export interface Phone {
  country: PhoneCountry;
  number: string;
}

export interface DialledCountry {
  country: PhoneCountry;
  national: string;
}

export interface PhoneCountryEntry {
  code: PhoneCountry;
  name: string;
  callingCode: string;
}

const REGIONS = new Intl.DisplayNames(['en'], { type: 'region' });

export function countryName(country: string): string {
  return REGIONS.of(country) ?? country;
}

export const PHONE_COUNTRIES: PhoneCountryEntry[] = getCountries()
  .map((code) => ({ code, name: countryName(code), callingCode: getCountryCallingCode(code) }))
  .sort((one, other) => one.name.localeCompare(other.name));

const KNOWN = new Set<string>(getCountries());

export function isPhoneCountry(value: string): value is PhoneCountry {
  return KNOWN.has(value);
}

export function read(number: string, country?: PhoneCountry): Phone | null {
  const parsed = parsePhoneNumberFromString(number, country);
  if (!parsed?.isValid() || !parsed.country) return null;
  if (country !== undefined && parsed.country !== country) return null;
  return { country: parsed.country, number: parsed.number };
}

export function detect(typed: string): DialledCountry | null {
  const written = typed.trim().replace(/^00/, '+');
  if (!written.startsWith('+')) return null;

  const reader = new AsYouType();
  reader.input(written);
  const country = reader.getCountry();
  if (!country) return null;

  return { country, national: reader.getNumber()?.nationalNumber ?? '' };
}

export function national(stored: string): string {
  return parsePhoneNumberFromString(stored)?.formatNational() ?? stored;
}

export function readable(stored: string): string {
  return parsePhoneNumberFromString(stored)?.formatInternational() ?? stored;
}
