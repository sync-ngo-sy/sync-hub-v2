import type { components } from '@sync/api-client';
import { PIPELINE_LADDER, type PipelineStatus, pipelineState } from './application';

export type ApplicationReview = components['schemas']['ApplicationReview'];
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
const EMAILED = 'the candidate has been emailed.';

export function moveOutcome(move: PipelineMove, candidateNotified: boolean): string {
  if (move.direction === 'rejection') return `${move.happened} — ${EMAILED}`;
  return `${move.happened} — ${candidateNotified ? TOLD : UNCHANGED}`;
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
