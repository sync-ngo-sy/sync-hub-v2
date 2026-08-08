import type { components } from '@sync/api-client';
import { http } from '@sync/api-client/testing';
import { VOCABULARY_PATH } from '@/features/crm/hooks/use-tag-vocabulary';
import type { Note } from '@/features/crm/note';
import type { Tag } from '@/features/crm/tag';
import { holding } from '@/testing/holding';
import type { ApplicationSummary, PipelineStatus } from '../application';
import type { MatchAssessment } from '../assessment';
import { NOTE_PATH, NOTES_PATH } from '../hooks/use-application-notes';
import { TAG_PATH, TAGS_PATH } from '../hooks/use-application-tags';
import type { ApplicationReview } from '../review';

type Problem = components['schemas']['ProblemDetail'];
type StatusChange = components['schemas']['ApplicationStatusChange'];
type NewNote = components['schemas']['NewNote'];
type NewTag = components['schemas']['NewTag'];
type OutgoingMessage = components['schemas']['OutgoingMessage'];
type QueuedMessage = components['schemas']['QueuedMessage'];

const PATH = '/v1/tenants/me/jobs/{job_id}/applications';
const REVIEW_PATH = '/v1/tenants/me/applications/{application_id}';
const ASSESSMENTS_PATH = '/v1/tenants/me/applications/{application_id}/assessments';
const ASSESSMENT_PATH = '/v1/tenants/me/applications/{application_id}/assessments/{assessment_id}';
const MESSAGES_PATH = '/v1/tenants/me/applications/{application_id}/messages';

const NO_SUCH_APPLICATION: Problem = {
  type: 'urn:sync:problem:not-found',
  title: 'Not Found',
  status: 404,
  detail: 'This tenant has no application with that id.',
};

export interface AskedFor {
  status: string | null;
  qualification_status: string | null;
}

export function listsJobApplications(items: ApplicationSummary[], asked?: AskedFor[]) {
  return [
    http.get(PATH, ({ query, response }) => {
      const status = query.get('status');
      const qualification = query.get('qualification_status');
      asked?.push({ status, qualification_status: qualification });
      return response(200).json({
        items: items
          .filter((item) => (status ? item.status === status : true))
          .filter((item) => (qualification ? item.qualification_status === qualification : true)),
        next_cursor: null,
      });
    }),
  ];
}

export function pagesJobApplications(pages: ApplicationSummary[][]) {
  return [
    http.get(PATH, ({ query, response }) => {
      const cursor = query.get('cursor');
      const index = cursor === null ? 0 : Number(cursor);
      return response(200).json({
        items: pages[index] ?? [],
        next_cursor: index + 1 < pages.length ? String(index + 1) : null,
      });
    }),
  ];
}

export function failsToListJobApplications(problem: Problem) {
  return [http.get(PATH, ({ response }) => response(500).json(problem))];
}

export function getsApplication(review: ApplicationReview) {
  return [
    http.get(REVIEW_PATH, ({ params, response }) =>
      params.application_id === review.id
        ? response(200).json(review)
        : response(404).json(NO_SUCH_APPLICATION),
    ),
  ];
}

export function failsToGetApplication(problem: Problem) {
  return [http.get(REVIEW_PATH, ({ response }) => response(500).json(problem))];
}

export function reviewsApplication(review: ApplicationReview, asked?: PipelineStatus[]) {
  let current = review;
  return [
    http.get(REVIEW_PATH, ({ params, response }) =>
      params.application_id === current.id
        ? response(200).json(current)
        : response(404).json(NO_SUCH_APPLICATION),
    ),
    http.patch(REVIEW_PATH, async ({ request, response }) => {
      const { status } = (await request.json()) as StatusChange;
      asked?.push(status);
      const previous = current.status;
      const changed_at = '2026-08-03T10:00:00Z';
      current = {
        ...current,
        status,
        history: [
          ...current.history,
          { status, previous_status: previous, source: 'recruiter', changed_at },
        ],
        updated_at: changed_at,
      };
      return response(200).json({ id: current.id, status, previous_status: previous, changed_at });
    }),
  ];
}

export function refusesApplicationMove(review: ApplicationReview, problem: Problem) {
  return [
    ...getsApplication(review),
    http.patch(REVIEW_PATH, ({ response }) => response(409).json(problem)),
  ];
}

const NO_SUCH_NOTE: Problem = {
  type: 'urn:sync:problem:not-found',
  title: 'Not Found',
  status: 404,
  detail: 'This tenant has no application, or no note on it, with that id.',
};

const NO_SUCH_TAG: Problem = {
  type: 'urn:sync:problem:not-found',
  title: 'Not Found',
  status: 404,
  detail: 'This tenant has no application or no tag with that id.',
};

const WROTE_AT = '2026-08-03T12:00:00Z';

const AUTHOR: Note['author'] = {
  id: '00000000-0000-4000-8000-000000000011',
  full_name: 'Rana Aljabri',
};

export function listsApplicationNotes(notes: Note[]) {
  return [http.get(NOTES_PATH, ({ response }) => response(200).json({ items: notes }))];
}

export function listsApplicationTags(on: Tag[], vocabulary: Tag[] = on) {
  return [
    http.get(VOCABULARY_PATH, ({ response }) => response(200).json(vocabulary)),
    http.get(TAGS_PATH, ({ response }) => response(200).json(on)),
  ];
}

export function keepsApplicationNotes(notes: Note[]) {
  let current = [...notes];
  let written = 0;

  const find = (noteId: string) => current.find((note) => note.id === noteId);

  return [
    http.get(NOTES_PATH, ({ response }) => response(200).json({ items: current })),
    http.post(NOTES_PATH, async ({ request, response }) => {
      const { text } = (await request.json()) as NewNote;
      written += 1;
      const note: Note = {
        id: `00000000-0000-4000-8000-00000000079${written}`,
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

export function failsToListApplicationNotes(problem: Problem) {
  return [http.get(NOTES_PATH, ({ response }) => response(500).json(problem))];
}

export function refusesApplicationNoteWrites(notes: Note[], problem: Problem) {
  return [
    http.get(NOTES_PATH, ({ response }) => response(200).json({ items: notes })),
    http.post(NOTES_PATH, ({ response }) => response(500).json(problem)),
    http.patch(NOTE_PATH, ({ response }) => response(500).json(problem)),
    http.delete(NOTE_PATH, ({ response }) => response(500).json(problem)),
  ];
}

export function pagesApplicationNotes(pages: Note[][]) {
  return [
    http.get(NOTES_PATH, ({ query, response }) => {
      const cursor = query.get('cursor');
      const index = cursor === null ? 0 : Number(cursor);
      return response(200).json({
        items: pages[index] ?? [],
        next_cursor: index + 1 < pages.length ? String(index + 1) : null,
      });
    }),
  ];
}

export interface TagSession {
  vocabulary: Tag[];
  on?: Tag[];
}

export function filesApplicationTags(session: TagSession, created?: NewTag[]) {
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
        id: `00000000-0000-4000-8000-00000000089${minted}`,
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

export function failsToListApplicationTags(problem: Problem) {
  return [
    http.get(VOCABULARY_PATH, ({ response }) => response(200).json([])),
    http.get(TAGS_PATH, ({ response }) => response(500).json(problem)),
  ];
}

export function refusesApplicationTag(session: TagSession, problem: Problem) {
  return [
    http.put(TAG_PATH, ({ response }) => response(409).json(problem)),
    ...filesApplicationTags(session),
  ];
}

export function refusesTenantTagCreation(session: TagSession, problem: Problem) {
  return [
    http.post(VOCABULARY_PATH, ({ response }) => response(409).json(problem)),
    ...filesApplicationTags(session),
  ];
}

export function listsMatchAssessments(items: MatchAssessment[]) {
  return [
    http.get(ASSESSMENTS_PATH, ({ response }) => response(200).json({ items, next_cursor: null })),
  ];
}

export function pagesMatchAssessments(pages: MatchAssessment[][]) {
  return [
    http.get(ASSESSMENTS_PATH, ({ query, response }) => {
      const cursor = query.get('cursor');
      const index = cursor === null ? 0 : Number(cursor);
      return response(200).json({
        items: pages[index] ?? [],
        next_cursor: index + 1 < pages.length ? String(index + 1) : null,
      });
    }),
  ];
}

export function failsToListMatchAssessments(problem: Problem) {
  return [http.get(ASSESSMENTS_PATH, ({ response }) => response(500).json(problem))];
}

export function failsToPageMatchAssessments(newest: MatchAssessment[], problem: Problem) {
  return [
    http.get(ASSESSMENTS_PATH, ({ query, response }) =>
      query.get('cursor')
        ? response(500).json(problem)
        : response(200).json({ items: newest, next_cursor: 'older' }),
    ),
  ];
}

export function assessesMatch(initial: MatchAssessment[], written: MatchAssessment) {
  let items = [...initial];
  return [
    http.get(ASSESSMENTS_PATH, ({ response }) => response(200).json({ items, next_cursor: null })),
    http.post(ASSESSMENTS_PATH, ({ response }) => {
      items = [written, ...items];
      return response(201).json(written);
    }),
  ];
}

export function failsToAssessMatch(
  initial: MatchAssessment[],
  problem: Problem,
  status: 429 | 502 | 503,
) {
  return [
    ...listsMatchAssessments(initial),
    http.post(ASSESSMENTS_PATH, ({ response }) => response(status).json(problem)),
  ];
}

const NO_SUCH_ASSESSMENT: Problem = {
  type: 'urn:sync:problem:assessment-not-found',
  title: 'Not Found',
  status: 404,
  detail: 'This tenant has no application, or no assessment of it, with that id.',
};

export function keepsMatchAssessments(initial: MatchAssessment[], forgotten?: string[]) {
  let items = [...initial];
  return [
    http.get(ASSESSMENTS_PATH, ({ response }) => response(200).json({ items, next_cursor: null })),
    http.delete(ASSESSMENT_PATH, ({ params, response }) => {
      if (!items.some((item) => item.id === params.assessment_id)) {
        return response(404).json(NO_SUCH_ASSESSMENT);
      }
      forgotten?.push(params.assessment_id);
      items = items.filter((item) => item.id !== params.assessment_id);
      return response(204).empty();
    }),
  ];
}

export function refusesMatchAssessmentDeletion(initial: MatchAssessment[], problem: Problem) {
  return [
    ...listsMatchAssessments(initial),
    http.delete(ASSESSMENT_PATH, ({ response }) => response(500).json(problem)),
  ];
}

export function holdsMatchAssessment(initial: MatchAssessment[], written: MatchAssessment) {
  const gate = holding();
  let items = [...initial];
  return {
    arrive: gate.arrive,
    handlers: [
      http.get(ASSESSMENTS_PATH, ({ response }) =>
        response(200).json({ items, next_cursor: null }),
      ),
      http.post(ASSESSMENTS_PATH, async ({ response }) => {
        await gate.held;
        items = [written, ...items];
        return response(201).json(written);
      }),
    ],
  };
}

export function messagesApplicant(queued: QueuedMessage, asked?: OutgoingMessage[]) {
  return [
    http.post(MESSAGES_PATH, async ({ request, response }) => {
      asked?.push((await request.json()) as OutgoingMessage);
      return response(201).json(queued);
    }),
  ];
}

export function refusesMessage(problem: Problem, status: 404 | 500) {
  return [http.post(MESSAGES_PATH, ({ response }) => response(status).json(problem))];
}

export function holdsMessage(queued: QueuedMessage) {
  const gate = holding();
  return {
    arrive: gate.arrive,
    handlers: [
      http.post(MESSAGES_PATH, async ({ response }) => {
        await gate.held;
        return response(201).json(queued);
      }),
    ],
  };
}

export function holdsJobApplications(items: ApplicationSummary[]) {
  const gate = holding();
  return {
    arrive: gate.arrive,
    handlers: [
      http.get(PATH, async ({ response }) => {
        await gate.held;
        return response(200).json({ items, next_cursor: null });
      }),
    ],
  };
}
