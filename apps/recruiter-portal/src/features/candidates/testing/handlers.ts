import type { components } from '@sync/api-client';
import { http } from '@sync/api-client/testing';
import type { Note } from '@/features/crm/note';
import { VOCABULARY_PATH } from '@/features/crm/reread';
import type { Tag } from '@/features/crm/tag';
import type { MatchedCandidate, SearchableCandidate } from '../candidate';
import { CANDIDATE_PATH, type CandidateRecord } from '../candidate-record';
import { DIRECTORY_PATH } from '../hooks/use-candidate-directory';
import { NOTE_PATH, NOTES_PATH } from '../hooks/use-candidate-notes';
import { SEARCH_PATH } from '../hooks/use-candidate-search';
import { TAG_PATH, TAGS_PATH } from '../hooks/use-candidate-tags';
import { CANDIDATE_OUT_OF_REACH } from './fixtures';

type Problem = components['schemas']['ProblemDetail'];
type NewNote = components['schemas']['NewNote'];
type NewTag = components['schemas']['NewTag'];

const WROTE_AT = '2026-08-03T12:00:00Z';

const AUTHOR: Note['author'] = {
  id: '00000000-0000-4000-8000-000000000011',
  full_name: 'Rana Aljabri',
};

const NO_SUCH_NOTE: Problem = {
  type: 'urn:sync:problem:not-found',
  title: 'Not Found',
  status: 404,
  detail: 'This tenant has no candidate, or no note on them, with that id.',
};

const NO_SUCH_TAG: Problem = {
  type: 'urn:sync:problem:not-found',
  title: 'Not Found',
  status: 404,
  detail: 'This tenant has no candidate or no tag with that id.',
};

export interface AskedSearch {
  q: string | null;
  location_key: string | null;
  language: string[];
  skill: string[];
  role: string | null;
  min_total_experience: string | null;
  keywords: string | null;
}

export interface AskedDirectory {
  sort: string | null;
  location_key: string | null;
  language: string[];
  skill: string[];
  role: string | null;
  min_total_experience: string | null;
}

export function findsCandidates(items: MatchedCandidate[], asked?: AskedSearch[]) {
  return [
    http.get(SEARCH_PATH, ({ query, response }) => {
      asked?.push({
        q: query.get('q'),
        location_key: query.get('location_key'),
        language: query.getAll('language'),
        skill: query.getAll('skill'),
        role: query.get('role'),
        min_total_experience: query.get('min_total_experience'),
        keywords: query.get('keywords'),
      });
      return response(200).json({ items, has_more: false, depth_reached: false });
    }),
  ];
}

export function failsToSearchCandidates(problem: Problem) {
  return [http.get(SEARCH_PATH, ({ response }) => response(503).json(problem))];
}

export function readsCandidate(record: CandidateRecord, asked?: string[]) {
  return [
    http.get(CANDIDATE_PATH, ({ params, response }) => {
      asked?.push(params.candidate_id);
      if (params.candidate_id !== record.candidate_id) {
        return response(404).json(CANDIDATE_OUT_OF_REACH);
      }
      return response(200).json(record);
    }),
  ];
}

export function reachesNoCandidate(asked?: string[]) {
  return [
    http.get(CANDIDATE_PATH, ({ params, response }) => {
      asked?.push(params.candidate_id);
      return response(404).json(CANDIDATE_OUT_OF_REACH);
    }),
  ];
}

/** `bySort` lets one test prove the order came from the API rather than from the browser: each
 * order answers with its own arrangement, and the table shows whichever was asked for. */
export function listsDirectoryCandidates(
  items: SearchableCandidate[],
  asked?: AskedDirectory[],
  bySort?: Record<string, SearchableCandidate[]>,
) {
  return [
    http.get(DIRECTORY_PATH, ({ query, response }) => {
      const sort = query.get('sort');
      asked?.push({
        sort,
        location_key: query.get('location_key'),
        language: query.getAll('language'),
        skill: query.getAll('skill'),
        role: query.get('role'),
        min_total_experience: query.get('min_total_experience'),
      });
      return response(200).json({
        items: (sort && bySort?.[sort]) || items,
        next_cursor: null,
      });
    }),
  ];
}

export function failsToListDirectoryCandidates(problem: Problem) {
  return [http.get(DIRECTORY_PATH, ({ response }) => response(500).json(problem))];
}

export function listsCandidateNotes(notes: Note[]) {
  return [http.get(NOTES_PATH, ({ response }) => response(200).json({ items: notes }))];
}

export function keepsCandidateNotes(notes: Note[], written?: string[]) {
  let current = [...notes];
  let count = 0;

  const find = (noteId: string) => current.find((note) => note.id === noteId);

  return [
    http.get(NOTES_PATH, ({ response }) => response(200).json({ items: current })),
    http.post(NOTES_PATH, async ({ request, response }) => {
      const { text } = (await request.json()) as NewNote;
      written?.push(text);
      count += 1;
      const note: Note = {
        id: `00000000-0000-4000-8000-00000000075${count}`,
        text,
        author: AUTHOR,
        created_at: WROTE_AT,
        updated_at: WROTE_AT,
      };
      current = [note, ...current];
      return response(201).json(note);
    }),
    http.patch(NOTE_PATH, async ({ params, request, response }) => {
      const note = find(params.note_id);
      if (!note) return response(404).json(NO_SUCH_NOTE);
      const { text } = (await request.json()) as NewNote;
      const rewritten = { ...note, text, updated_at: WROTE_AT };
      current = current.map((each) => (each.id === note.id ? rewritten : each));
      return response(200).json(rewritten);
    }),
    http.delete(NOTE_PATH, ({ params, response }) => {
      if (!find(params.note_id)) return response(404).json(NO_SUCH_NOTE);
      current = current.filter((note) => note.id !== params.note_id);
      return response(204).empty();
    }),
  ];
}

export function failsToListCandidateNotes(problem: Problem) {
  return [http.get(NOTES_PATH, ({ response }) => response(500).json(problem))];
}

export interface CandidateTagSession {
  vocabulary: Tag[];
  on?: Tag[];
}

export function listsCandidateTags(on: Tag[], vocabulary: Tag[] = on) {
  return [
    http.get(VOCABULARY_PATH, ({ query, response }) => {
      const scope = query.get('scope');
      return response(200).json(vocabulary.filter((tag) => (scope ? tag.scope === scope : true)));
    }),
    http.get(TAGS_PATH, ({ response }) => response(200).json(on)),
  ];
}

export function filesCandidateTags(session: CandidateTagSession, created?: NewTag[]) {
  let vocabulary = [...session.vocabulary];
  let on = [...(session.on ?? [])];
  let minted = 0;

  return [
    http.get(VOCABULARY_PATH, ({ query, response }) => {
      const scope = query.get('scope');
      return response(200).json(vocabulary.filter((tag) => (scope ? tag.scope === scope : true)));
    }),
    http.post(VOCABULARY_PATH, async ({ request, response }) => {
      const body = (await request.json()) as NewTag;
      created?.push(body);
      minted += 1;
      const tag: Tag = {
        id: `00000000-0000-4000-8000-00000000085${minted}`,
        name: body.name,
        scope: body.scope,
        created_at: WROTE_AT,
      };
      vocabulary = [...vocabulary, tag];
      return response(201).json(tag);
    }),
    http.get(TAGS_PATH, ({ response }) => response(200).json(on)),
    http.put(TAG_PATH, ({ params, response }) => {
      const tag = vocabulary.find((each) => each.id === params.tag_id);
      if (!tag) return response(404).json(NO_SUCH_TAG);
      if (!on.some((each) => each.id === tag.id)) on = [...on, tag];
      return response(200).json(tag);
    }),
    http.delete(TAG_PATH, ({ params, response }) => {
      on = on.filter((tag) => tag.id !== params.tag_id);
      return response(204).empty();
    }),
  ];
}

export function failsToListCandidateTags(problem: Problem) {
  return [
    http.get(VOCABULARY_PATH, ({ response }) => response(200).json([])),
    http.get(TAGS_PATH, ({ response }) => response(500).json(problem)),
  ];
}
