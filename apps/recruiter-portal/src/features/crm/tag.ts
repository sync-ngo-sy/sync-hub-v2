import type { components } from '@sync/api-client';

export type Tag = components['schemas']['Tag'];
export type TagScope = components['schemas']['TagScope'];

export interface TagChoice {
  id: string;
  name: string;
  isOn: boolean;
}

function fold(value: string): string {
  return value.trim().toLocaleLowerCase();
}

export function tagChoices(vocabulary: Tag[], on: Tag[], query: string): TagChoice[] {
  const wanted = fold(query);
  const already = new Set(on.map((tag) => tag.id));

  return vocabulary
    .filter((tag) => fold(tag.name).includes(wanted))
    .map((tag) => ({ id: tag.id, name: tag.name, isOn: already.has(tag.id) }));
}

export const TAG_SCOPES = ['application', 'candidate'] as const satisfies readonly TagScope[];

/** Keyed by the generated union, so a scope the platform adds fails to compile until it has a
 * word here. The pickers and the vocabulary read these; the API takes the key. */
export const SCOPE_LABELS: Record<TagScope, string> = {
  application: 'Applications',
  candidate: 'Candidates',
};

/** What each scope files, in the one place a Recruiter has to choose between them. */
export const SCOPE_DESCRIPTIONS: Record<TagScope, string> = {
  application: 'Files one Application — this person, for this Job.',
  candidate: 'Files a Candidate, whatever they have applied to.',
};

/**
 * The Tag already holding a name in a scope, if the Tenant has one — so a form can refuse a
 * duplicate before the API does, and name the Tag the Tenant actually has rather than the
 * spelling that was typed. A Tag being renamed is never its own clash.
 */
export function tagNamed(
  vocabulary: Tag[],
  wanted: { name: string; scope: TagScope; except?: string },
): Tag | undefined {
  return vocabulary.find(
    (tag) =>
      tag.id !== wanted.except &&
      tag.scope === wanted.scope &&
      fold(tag.name) === fold(wanted.name),
  );
}

export function tagToCreate(vocabulary: Tag[], query: string): string | null {
  const name = query.trim();
  if (name === '') return null;

  const taken = vocabulary.some((tag) => fold(tag.name) === fold(name));
  return taken ? null : name;
}

export interface TagsWidget {
  vocabulary: Tag[];
  on: Tag[];
  isPending: boolean;
  isChanging: boolean;
  error: unknown;
  refetch: () => void;
  put: (tagId: string) => Promise<unknown>;
  take: (tagId: string) => Promise<unknown>;
  create: (name: string) => Promise<unknown>;
}
