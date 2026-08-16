import type { components } from '@sync/api-client';
import { http } from '@sync/api-client/testing';
import { VOCABULARY_PATH } from '@/features/crm/hooks/use-tag-vocabulary';
import type { Note } from '@/features/crm/note';
import type { Tag } from '@/features/crm/tag';
import { holding } from '@/testing/holding';
import {
  type ApplicationSummary,
  PIPELINE_STATUSES,
  type PipelineStatus,
  RECEIVED_WITHIN_VALUES,
  type ReceivedWithin,
  SCREENING_VERDICTS,
  type TenantApplication,
} from '../application';
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
const TENANT_PATH = '/v1/tenants/me/applications';
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
  status: string[];
  qualification_status: string[];
  sort: string | null;
}

/** The `coalesce(…, -1)` the API orders on: unread sorts below every score. */
function scoreOf(item: ApplicationSummary): number {
  return item.match?.percentage ?? -1;
}

function byMatch(sort: string | null) {
  const bestFirst = sort !== 'lowest_match';
  return (one: ApplicationSummary, other: ApplicationSummary) => {
    const gap = scoreOf(one) - scoreOf(other);
    return bestFirst ? -gap : gap;
  };
}

function chosen(named: string[], value: string): boolean {
  return named.length === 0 || named.includes(value);
}

function countedByStatus(items: ApplicationSummary[]) {
  return PIPELINE_STATUSES.map((status) => ({
    status,
    count: items.filter((item) => item.status === status).length,
  }));
}

function countedByVerdict(items: ApplicationSummary[]) {
  return SCREENING_VERDICTS.map((verdict) => ({
    verdict,
    count: items.filter((item) => item.qualification_status === verdict).length,
  }));
}

export function listsJobApplications(items: ApplicationSummary[], asked?: AskedFor[]) {
  return [
    http.get(PATH, ({ query, response }) => {
      const statuses = query.getAll('status');
      const verdicts = query.getAll('qualification_status');
      const sort = query.get('sort');
      asked?.push({ status: statuses, qualification_status: verdicts, sort });
      const ofThisVerdict = items.filter((item) => chosen(verdicts, item.qualification_status));
      const ofThisStatus = items.filter((item) => chosen(statuses, item.status));
      const listed = ofThisVerdict.filter((item) => chosen(statuses, item.status));
      return response(200).json({
        items: sort?.endsWith('_match') ? [...listed].sort(byMatch(sort)) : listed,
        next_cursor: null,
        status_counts: countedByStatus(ofThisVerdict),
        verdict_counts: countedByVerdict(ofThisStatus),
      });
    }),
  ];
}

const WINDOW_DAYS: Record<ReceivedWithin, number> = { '24h': 1, '7d': 7, '30d': 30 };

const DAY = 24 * 60 * 60 * 1000;

export interface TenantAskedFor {
  status: string[];
  qualification_status: string[];
  received_within: string | null;
  sort: string | null;
}

function inTheWindow(item: TenantApplication, window: string | null): boolean {
  const named = RECEIVED_WITHIN_VALUES.find((one) => one === window);
  if (!named) return true;
  return new Date(item.applied_at).getTime() > Date.now() - WINDOW_DAYS[named] * DAY;
}

function byReceived(sort: string | null) {
  const newestFirst = sort !== 'oldest';
  return (one: TenantApplication, other: TenantApplication) => {
    const gap = Date.parse(one.applied_at) - Date.parse(other.applied_at);
    return newestFirst ? -gap : gap;
  };
}

export function listsTenantApplications(items: TenantApplication[], asked?: TenantAskedFor[]) {
  return [
    http.get(TENANT_PATH, ({ query, response }) => {
      const statuses = query.getAll('status');
      const verdicts = query.getAll('qualification_status');
      const window = query.get('received_within');
      const sort = query.get('sort');
      asked?.push({
        status: statuses,
        qualification_status: verdicts,
        received_within: window,
        sort,
      });
      const inWindow = items.filter((item) => inTheWindow(item, window));
      const ofThisStatus = inWindow.filter((item) => chosen(statuses, item.status));
      const ofThisVerdict = inWindow.filter((item) => chosen(verdicts, item.qualification_status));
      const limit = Number(query.get('limit') ?? inWindow.length);
      return response(200).json({
        items: ofThisStatus
          .filter((item) => chosen(verdicts, item.qualification_status))
          .sort(byReceived(sort))
          .slice(0, limit),
        next_cursor: null,
        status_counts: countedByStatus(ofThisVerdict),
        verdict_counts: countedByVerdict(ofThisStatus),
      });
    }),
  ];
}

export function pagesTenantApplications(pages: TenantApplication[][]) {
  return [
    http.get(TENANT_PATH, ({ query, response }) => {
      const cursor = query.get('cursor');
      const index = cursor === null ? 0 : Number(cursor);
      return response(200).json({
        items: pages[index] ?? [],
        next_cursor: index + 1 < pages.length ? String(index + 1) : null,
        status_counts: countedByStatus(pages.flat()),
        verdict_counts: countedByVerdict(pages.flat()),
      });
    }),
  ];
}

export function failsToListTenantApplications(problem: Problem) {
  return [http.get(TENANT_PATH, ({ response }) => response(500).json(problem))];
}

export function pagesJobApplications(pages: ApplicationSummary[][]) {
  return [
    http.get(PATH, ({ query, response }) => {
      const cursor = query.get('cursor');
      const index = cursor === null ? 0 : Number(cursor);
      return response(200).json({
        items: pages[index] ?? [],
        next_cursor: index + 1 < pages.length ? String(index + 1) : null,
        status_counts: countedByStatus(pages.flat()),
        verdict_counts: countedByVerdict(pages.flat()),
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

// The API's Stage projection, restated for the fake server so a move it answers says whether the
// candidate heard about it. The portal itself never projects: it reads the answer.
const STAGE_OF: Record<PipelineStatus, string> = {
  new: 'received',
  reviewing: 'in_review',
  shortlisted: 'in_review',
  interview: 'in_review',
  offer: 'in_review',
  hired: 'hired',
  rejected: 'not_selected',
  withdrawn: 'withdrawn',
};

export function reviewsApplication(review: ApplicationReview, asked?: PipelineStatus[]) {
  let current = review;
  return [
    http.get(REVIEW_PATH, ({ params, response }) =>
      params.application_id === current.id
        ? response(200).json(current)
        : response(404).json(NO_SUCH_APPLICATION),
    ),
    http.patch(REVIEW_PATH, async ({ request, response }) => {
      const { status, start_date } = (await request.json()) as StatusChange;
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
        hire: start_date
          ? {
              start_date,
              confirmation: 'unanswered' as const,
              claimed_at: changed_at,
              answered_at: null,
            }
          : current.hire,
        updated_at: changed_at,
      };
      return response(200).json({
        id: current.id,
        status,
        previous_status: previous,
        candidate_notified: STAGE_OF[status] !== STAGE_OF[previous],
        changed_at,
      });
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

const NO_SUCH_ASSESSMENT: Problem = {
  type: 'urn:sync:problem:assessment-not-found',
  title: 'Not Found',
  status: 404,
  detail: 'This tenant has no application, or no assessment of it, with that id.',
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

export function forgetsMatchAssessments(initial: MatchAssessment[], forgotten?: string[]) {
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

export function holdsMatchAssessmentDeletion(initial: MatchAssessment[]) {
  const gate = holding();
  let items = [...initial];
  return {
    arrive: gate.arrive,
    handlers: [
      http.get(ASSESSMENTS_PATH, ({ response }) =>
        response(200).json({ items, next_cursor: null }),
      ),
      http.delete(ASSESSMENT_PATH, async ({ params, response }) => {
        await gate.held;
        items = items.filter((item) => item.id !== params.assessment_id);
        return response(204).empty();
      }),
    ],
  };
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
        return response(200).json({
          items,
          next_cursor: null,
          status_counts: countedByStatus(items),
          verdict_counts: countedByVerdict(items),
        });
      }),
    ],
  };
}
