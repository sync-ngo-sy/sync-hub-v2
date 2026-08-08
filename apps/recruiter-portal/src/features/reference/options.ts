import type { components } from '@sync/api-client';
import type { ComboboxOption, ComboboxOptionGroup } from '@sync/ui/components/combobox';

type CanonicalRole = components['schemas']['CanonicalRole'];
type CanonicalSkill = components['schemas']['CanonicalSkill'];
type Language = components['schemas']['Language'];
type Location = components['schemas']['Location'];

export function roleOptions(roles: CanonicalRole[] | undefined): ComboboxOption[] {
  return (roles ?? []).map((role) => ({ value: role.key, label: role.name }));
}

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

export function languageOptions(
  languages: Language[] | undefined,
  taken: Iterable<string> = [],
): ComboboxOption[] {
  const already = new Set(taken);
  return (languages ?? [])
    .filter((language) => !already.has(language.code))
    .map((language) => ({ value: language.code, label: language.name }));
}

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
