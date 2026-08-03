import type { components } from '@sync/api-client';
import { http } from '@sync/api-client/testing';
import { VOCABULARY_PATH, VOCABULARY_TAG_PATH } from '../hooks/use-tag-vocabulary';
import type { Tag } from '../tag';

type Problem = components['schemas']['ProblemDetail'];
type NewTag = components['schemas']['NewTag'];
type TagChanges = components['schemas']['TagChanges'];

const NO_SUCH_TAG: Problem = {
  type: 'urn:sync:problem:not-found',
  title: 'Not Found',
  status: 404,
  detail: 'This tenant has no tag with that id.',
};

function takenName(name: string): Problem {
  return {
    type: 'urn:sync:problem:tag-name-taken',
    title: 'Conflict',
    status: 409,
    detail: `This tenant already has a tag called “${name}” in that scope.`,
  };
}

export function listsVocabulary(tags: Tag[]) {
  return [http.get(VOCABULARY_PATH, ({ response }) => response(200).json(tags))];
}

export function failsToListVocabulary(problem: Problem) {
  return [http.get(VOCABULARY_PATH, ({ response }) => response(500).json(problem))];
}

export function refusesTagRename(problem: Problem) {
  return [http.patch(VOCABULARY_TAG_PATH, ({ response }) => response(409).json(problem))];
}

export function failsToDeleteTag(problem: Problem) {
  return [http.delete(VOCABULARY_TAG_PATH, ({ response }) => response(500).json(problem))];
}

export interface VocabularySpies {
  onCreate?: (body: NewTag) => void;
  onRename?: (tagId: string, body: TagChanges) => void;
  onDelete?: (tagId: string) => void;
}

/**
 * The vocabulary as the API keeps it: whole when nothing is asked of it, narrowed to a scope for
 * a picker, and unique by name within each scope.
 */
export function curatesVocabulary(initial: Tag[], spies: VocabularySpies = {}) {
  let vocabulary = [...initial];
  let minted = 0;

  const clashes = (name: string, scope: Tag['scope'], except?: string) =>
    vocabulary.some(
      (tag) =>
        tag.id !== except &&
        tag.scope === scope &&
        tag.name.toLocaleLowerCase() === name.toLocaleLowerCase(),
    );

  return [
    http.get(VOCABULARY_PATH, ({ query, response }) => {
      const scope = query.get('scope');
      return response(200).json(
        scope ? vocabulary.filter((tag) => tag.scope === scope) : vocabulary,
      );
    }),

    http.post(VOCABULARY_PATH, async ({ request, response }) => {
      const written = (await request.json()) as NewTag;
      spies.onCreate?.(written);
      if (clashes(written.name, written.scope)) return response(409).json(takenName(written.name));

      minted += 1;
      const tag: Tag = {
        id: `00000000-0000-4000-8000-0000000008${String(50 + minted)}`,
        name: written.name,
        scope: written.scope,
        created_at: '2026-08-03T09:00:00Z',
      };
      vocabulary = [...vocabulary, tag];
      return response(201).json(tag);
    }),

    http.patch(VOCABULARY_TAG_PATH, async ({ params, request, response }) => {
      const changes = (await request.json()) as TagChanges;
      const current = vocabulary.find((tag) => tag.id === params.tag_id);
      if (!current) return response(404).json(NO_SUCH_TAG);
      if (clashes(changes.name, current.scope, current.id))
        return response(409).json(takenName(changes.name));

      spies.onRename?.(params.tag_id, changes);
      const renamed: Tag = { ...current, name: changes.name };
      vocabulary = vocabulary.map((tag) => (tag.id === renamed.id ? renamed : tag));
      return response(200).json(renamed);
    }),

    http.delete(VOCABULARY_TAG_PATH, ({ params, response }) => {
      if (!vocabulary.some((tag) => tag.id === params.tag_id))
        return response(404).json(NO_SUCH_TAG);

      spies.onDelete?.(params.tag_id);
      vocabulary = vocabulary.filter((tag) => tag.id !== params.tag_id);
      return response(204).empty();
    }),
  ];
}
