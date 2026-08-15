import type { FieldErrors } from 'react-hook-form';
import type { Requirement } from './completeness';
import { NAMED_IN_ORDER, PLACES, REQUIREMENT_PLACES } from './places';
import type { ProfileFormValues } from './schemas/profile';

interface Unanswered {
  place: string;
  message: string | null;
}

function unanswered(errors: FieldErrors<ProfileFormValues>): Unanswered[] {
  const found: Unanswered[] = [];
  for (const name of NAMED_IN_ORDER) {
    const error = errors[name];
    if (error === undefined) continue;

    const { label } = PLACES[name];
    const message = (error as { message?: string }).message ?? null;
    const already = found.find((entry) => entry.place === label);
    if (already) already.message ??= message;
    else found.push({ place: label, message });
  }
  return found;
}

function inWords(places: readonly string[]): string {
  const last = places.at(-1);
  if (last === undefined) return '';
  if (places.length === 1) return last;
  return `${places.slice(0, -1).join(', ')} and ${last}`;
}

export function whatIsUnanswered(errors: FieldErrors<ProfileFormValues>): string {
  const found = unanswered(errors);
  const [first] = found;
  if (first === undefined) {
    return 'Your profile was not saved. Look for the fields marked in red.';
  }
  if (found.length === 1 && first.message) {
    return `Your profile was not saved. ${first.message}`;
  }
  return `Your profile was not saved. Still to do: ${inWords(found.map((entry) => entry.place))}.`;
}

export function whyRecruitersCannotFindYou(missing: readonly Requirement[]): string {
  const places = missing.map((requirement) => REQUIREMENT_PLACES[requirement].label);
  return `Saved. Recruiters cannot find you yet — still to do: ${inWords(places)}.`;
}
