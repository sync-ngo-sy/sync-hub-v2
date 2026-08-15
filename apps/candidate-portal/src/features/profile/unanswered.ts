import type { FieldErrors } from 'react-hook-form';
import type { ProfileFormValues } from './schemas/profile';

type Name = keyof ProfileFormValues;

const PLACES = [
  ['full_name', 'Your name'],
  ['phone', 'Phone'],
  ['phone_country', 'Phone'],
  ['headline', 'Headline'],
  ['location_key', 'Location'],
  ['canonical_role_key', 'What you do'],
  ['summary', 'Summary'],
  ['is_searchable', 'Let recruiters find me'],
  ['experiences', 'Experience'],
  ['educations', 'Education'],
  ['skills', 'Skills'],
  ['unmapped_skills', 'Other skills'],
  ['languages', 'Languages'],
  ['projects', 'Projects'],
  ['linkedin_url', 'Links'],
  ['github_url', 'Links'],
  ['portfolio_url', 'Links'],
] as const satisfies readonly (readonly [Name, string])[];

function unansweredPlaces(errors: FieldErrors<ProfileFormValues>): string[] {
  const places: string[] = [];
  for (const [name, place] of PLACES) {
    if (errors[name] === undefined) continue;
    if (!places.includes(place)) places.push(place);
  }
  return places;
}

function ownMessage(errors: FieldErrors<ProfileFormValues>, place: string): string | null {
  for (const [name, named] of PLACES) {
    if (named !== place) continue;
    const message = (errors[name] as { message?: string } | undefined)?.message;
    if (message) return message;
  }
  return null;
}

function inWords(places: readonly string[]): string {
  const last = places.at(-1);
  if (last === undefined) return '';
  if (places.length === 1) return last;
  return `${places.slice(0, -1).join(', ')} and ${last}`;
}

export function whatIsUnanswered(errors: FieldErrors<ProfileFormValues>): string {
  const places = unansweredPlaces(errors);
  const [first] = places;
  if (first === undefined) {
    return 'Your profile was not saved. Look for the fields marked in red.';
  }

  const only = places.length === 1 ? ownMessage(errors, first) : null;
  if (only) return `Your profile was not saved. ${only}`;

  return `Your profile was not saved. Still to do: ${inWords(places)}.`;
}
