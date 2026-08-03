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
  error: unknown;
  refetch: () => void;
  put: (tagId: string) => Promise<unknown>;
  take: (tagId: string) => Promise<unknown>;
  create: (name: string) => Promise<unknown>;
}
