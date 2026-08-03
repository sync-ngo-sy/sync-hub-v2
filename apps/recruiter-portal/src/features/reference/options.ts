import type { components } from '@sync/api-client';
import type { ComboboxOption, ComboboxOptionGroup } from '@sync/ui/components/combobox';

type CanonicalSkill = components['schemas']['CanonicalSkill'];
type Language = components['schemas']['Language'];
type Location = components['schemas']['Location'];

/** A Canonical skill is named by its name, so the value a form saves is the label on screen.
 * The API answers in category then name order, which makes the grouping a fold rather than a
 * sort — and a category all of whose skills are taken simply never opens. */
export function skillGroups(
  skills: CanonicalSkill[] | undefined,
  taken: Iterable<string> = [],
): ComboboxOptionGroup[] {
  const already = new Set(taken);
  const groups: ComboboxOptionGroup[] = [];
  for (const skill of skills ?? []) {
    if (already.has(skill.name)) continue;
    const current = groups.at(-1);
    const option = { value: skill.name, label: skill.name };
    if (current?.label === skill.category) current.options.push(option);
    else groups.push({ label: skill.category, options: [option] });
  }
  return groups;
}

/** A language reads as its name and saves as its code. */
export function languageOptions(
  languages: Language[] | undefined,
  taken: Iterable<string> = [],
): ComboboxOption[] {
  const already = new Set(taken);
  return (languages ?? [])
    .filter((language) => !already.has(language.code))
    .map((language) => ({ value: language.code, label: language.name }));
}

/** The other direction: a stored code read back as the name a Recruiter knows it by, and nothing
 * at all while the taxonomy that names it is still on the wire — a raw code is not a language. */
export function languageName(
  languages: Language[] | undefined,
  code: string | null | undefined,
): string | null {
  if (!code) return null;
  return languages?.find((language) => language.code === code)?.name ?? null;
}

/** A Location reads as its name and saves as its key, grouped by the heading the API files it
 * under — Syria's governorates, then everywhere else by country. */
export function locationGroups(locations: Location[] | undefined): ComboboxOptionGroup[] {
  const groups: ComboboxOptionGroup[] = [];
  for (const location of locations ?? []) {
    const current = groups.at(-1);
    const option = { value: location.key, label: location.name };
    if (current?.label === location.group) current.options.push(option);
    else groups.push({ label: location.group, options: [option] });
  }
  return groups;
}
