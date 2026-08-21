import type { components } from '@sync/api-client';
import { absoluteDate } from '@/lib/dates';
import { PIPELINE_LADDER, type PipelineStatus, pipelineState } from './application';

export type ApplicationReview = components['schemas']['ApplicationReview'];
export type MovedApplication = components['schemas']['MovedApplication'];
export type AnsweredQuestion = components['schemas']['AnsweredQuestion'];
export type StatusHistoryEntry = components['schemas']['StatusHistoryEntry'];
export type HireClaim = components['schemas']['HireClaim'];
type StatusChangeSource = components['schemas']['StatusChangeSource'];

export type MoveDirection = 'onward' | 'back' | 'rejection';

export interface PipelineMove {
  target: PipelineStatus;
  label: string;
  happened: string;
  direction: MoveDirection;
}

const TO_REVIEWING: PipelineMove = {
  target: 'reviewing',
  label: 'Move to Reviewing',
  happened: 'Moved to Reviewing',
  direction: 'onward',
};
const TO_SHORTLISTED: PipelineMove = {
  target: 'shortlisted',
  label: 'Move to Shortlisted',
  happened: 'Shortlisted',
  direction: 'onward',
};
const TO_INTERVIEW: PipelineMove = {
  target: 'interview',
  label: 'Move to Interview',
  happened: 'Moved to Interview',
  direction: 'onward',
};
const TO_OFFER: PipelineMove = {
  target: 'offer',
  label: 'Move to Offer',
  happened: 'Moved to Offer',
  direction: 'onward',
};
const TO_HIRED: PipelineMove = {
  target: 'hired',
  label: 'Mark as hired',
  happened: 'Marked as hired',
  direction: 'onward',
};
const TO_REJECTED: PipelineMove = {
  target: 'rejected',
  label: 'Reject',
  happened: 'Rejected',
  direction: 'rejection',
};

const BACK_TO_NEW: PipelineMove = {
  target: 'new',
  label: 'Move back to New',
  happened: 'Moved back to New',
  direction: 'back',
};
const BACK_TO_REVIEWING: PipelineMove = {
  target: 'reviewing',
  label: 'Move back to Reviewing',
  happened: 'Moved back to Reviewing',
  direction: 'back',
};
const BACK_TO_SHORTLISTED: PipelineMove = {
  target: 'shortlisted',
  label: 'Move back to Shortlisted',
  happened: 'Moved back to Shortlisted',
  direction: 'back',
};
const BACK_TO_INTERVIEW: PipelineMove = {
  target: 'interview',
  label: 'Move back to Interview',
  happened: 'Moved back to Interview',
  direction: 'back',
};
const REOPEN: PipelineMove = {
  target: 'reviewing',
  label: 'Reopen for review',
  happened: 'Reopened for review',
  direction: 'back',
};

const PIPELINE_MOVES: Record<PipelineStatus, PipelineMove[]> = {
  new: [TO_REVIEWING, TO_SHORTLISTED, TO_INTERVIEW, TO_OFFER, TO_HIRED, TO_REJECTED],
  reviewing: [TO_SHORTLISTED, TO_INTERVIEW, TO_OFFER, TO_HIRED, TO_REJECTED, BACK_TO_NEW],
  shortlisted: [TO_INTERVIEW, TO_OFFER, TO_HIRED, TO_REJECTED, BACK_TO_REVIEWING, BACK_TO_NEW],
  interview: [TO_OFFER, TO_HIRED, TO_REJECTED, BACK_TO_SHORTLISTED, BACK_TO_REVIEWING, BACK_TO_NEW],
  offer: [
    TO_HIRED,
    TO_REJECTED,
    BACK_TO_INTERVIEW,
    BACK_TO_SHORTLISTED,
    BACK_TO_REVIEWING,
    BACK_TO_NEW,
  ],
  hired: [],
  rejected: [REOPEN],
  withdrawn: [],
};

const OUTCOME: Partial<Record<PipelineStatus, string>> = {
  hired: 'Hired. This Application is closed — nothing moves it.',
  withdrawn: 'The candidate withdrew. That was theirs to do, and nothing moves it now.',
};

export function pipelineMoves(status: PipelineStatus): PipelineMove[] {
  return PIPELINE_MOVES[status];
}

export interface PipelineMoveChoices {
  adjacent: PipelineMove[];
  other: PipelineMove[];
}

export function pipelineMoveChoices(status: PipelineStatus): PipelineMoveChoices {
  const moves = pipelineMoves(status);
  const currentIndex = (PIPELINE_LADDER as readonly PipelineStatus[]).indexOf(status);
  const previousStatus = currentIndex > 0 ? PIPELINE_LADDER[currentIndex - 1] : null;
  const nextStatus =
    currentIndex >= 0 && currentIndex < PIPELINE_LADDER.length - 1
      ? PIPELINE_LADDER[currentIndex + 1]
      : null;
  const previousMove = moves.find((move) => move.target === previousStatus);
  const nextMove = moves.find((move) => move.target === nextStatus);
  const adjacent =
    currentIndex >= 0
      ? [previousMove, nextMove].filter((move): move is PipelineMove => move !== undefined)
      : [];

  return { adjacent, other: moves.filter((move) => !adjacent.includes(move)) };
}

export function pipelineOutcome(status: PipelineStatus): string | null {
  return OUTCOME[status] ?? null;
}

const TOLD = 'the candidate has been told.';
const UNCHANGED = 'the candidate sees no change.';
const CANCELLED = 'the candidate was never told, and the email is cancelled.';
const NO_EMAIL = 'no email is sent.';

export function moveOutcome(move: PipelineMove, moved: MovedApplication, now = new Date()): string {
  // `rejected` is the only state a reopen leaves, so where it came from says which of the two
  // reopens this was without the page having to know which button was pressed.
  if (moved.previous_status === 'rejected') {
    const day = dayTheyWereTold(moved.told_at, now);
    return `${move.happened} — ${day ? `the candidate was told on ${day}, and ${NO_EMAIL}` : CANCELLED}`;
  }
  if (move.direction === 'rejection' && moved.told_at) {
    return `${move.happened} — the candidate hears on ${absoluteDate(moved.told_at)}.`;
  }
  return `${move.happened} — ${moved.candidate_notified ? TOLD : UNCHANGED}`;
}

export interface Telling {
  /** Whether the candidate has read the rejection this Telling belongs to. */
  told: boolean;
  /** Set only where the Recruiter is about to act on it, and it is theirs to weigh. */
  title: string | null;
  text: string;
}

/**
 * What the review says about the Telling, which is not only a warning: a Telling outlives the
 * rejection that set it, so a reopened Application still says the candidate read one. Only
 * where reopening is still ahead of the Recruiter does it carry a title and become a warning.
 */
export function telling(
  status: PipelineStatus,
  toldAt: string | null | undefined,
  now = new Date(),
): Telling | null {
  if (!toldAt) return null;
  const day = dayTheyWereTold(toldAt, now);
  if (status !== 'rejected') {
    if (!day) return null;
    return {
      told: true,
      title: null,
      text:
        `The candidate was told on ${day} that they were not selected, and has not been told ` +
        'they are back in review.',
    };
  }
  if (!day) {
    return {
      told: false,
      title: null,
      text:
        `The candidate has not been told. They hear on ${absoluteDate(toldAt)} — until then, ` +
        'reopening this cancels the email and leaves them in review.',
    };
  }
  return {
    told: true,
    title: 'Already told',
    text:
      `The candidate was told on ${day}. Reopening sends no email — message them by hand if ` +
      'they should know.',
  };
}

function dayTheyWereTold(toldAt: string | null | undefined, now: Date): string | null {
  if (!toldAt || new Date(toldAt) > now) return null;
  return absoluteDate(toldAt);
}

const HIRE_STATE: Record<HireClaim['confirmation'], string> = {
  unanswered: 'Waiting for the candidate to confirm. Until they do, this is a claim.',
  confirmed: 'The candidate confirmed this. It is a placement.',
  denied: 'The candidate says they did not start. This is not a placement.',
};

export function hireState(hire: HireClaim): string {
  return HIRE_STATE[hire.confirmation];
}

const CHANGED_BY: Record<StatusChangeSource, string> = {
  recruiter: 'by a recruiter',
  candidate: 'by the candidate',
  system: 'by the platform',
};

export interface HistoryLine {
  title: string;
  detail: string;
}

export function historyLine(entry: StatusHistoryEntry): HistoryLine {
  const by = CHANGED_BY[entry.source];
  if (!entry.previous_status) return { title: 'Applied', detail: by };
  return {
    title: `Moved to ${pipelineState(entry.status).label}`,
    detail: `from ${pipelineState(entry.previous_status).label} · ${by}`,
  };
}

export function answerText(answer: AnsweredQuestion): string {
  if (answer.question_type === 'yes_no') {
    if (answer.answer_boolean === null || answer.answer_boolean === undefined)
      return 'Not answered';
    return answer.answer_boolean ? 'Yes' : 'No';
  }
  return answer.answer_text?.trim() || 'Not answered';
}
