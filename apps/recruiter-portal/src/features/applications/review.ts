import type { components } from '@sync/api-client';
import {
  CalendarCheck,
  CircleCheck,
  CircleX,
  Eye,
  Handshake,
  ListChecks,
  type LucideIcon,
  RotateCcw,
  Undo2,
} from 'lucide-react';
import { type PipelineStatus, pipelineState } from './application';

export type ApplicationReview = components['schemas']['ApplicationReview'];
export type AnsweredQuestion = components['schemas']['AnsweredQuestion'];
export type StatusHistoryEntry = components['schemas']['StatusHistoryEntry'];
type StatusChangeSource = components['schemas']['StatusChangeSource'];

export interface PipelineMove {
  target: PipelineStatus;
  label: string;
  success: string;
  icon: LucideIcon;
}

const TOLD = 'the candidate has been told.';

const TO_REVIEWING: PipelineMove = {
  target: 'reviewing',
  label: 'Move to Reviewing',
  success: `Moved to Reviewing — ${TOLD}`,
  icon: Eye,
};
const TO_SHORTLISTED: PipelineMove = {
  target: 'shortlisted',
  label: 'Move to Shortlisted',
  success: `Shortlisted — ${TOLD}`,
  icon: ListChecks,
};
const TO_INTERVIEW: PipelineMove = {
  target: 'interview',
  label: 'Move to Interview',
  success: `Moved to Interview — ${TOLD}`,
  icon: CalendarCheck,
};
const TO_OFFER: PipelineMove = {
  target: 'offer',
  label: 'Move to Offer',
  success: `Moved to Offer — ${TOLD}`,
  icon: Handshake,
};
const TO_HIRED: PipelineMove = {
  target: 'hired',
  label: 'Mark as hired',
  success: `Marked as hired — ${TOLD}`,
  icon: CircleCheck,
};
const TO_REJECTED: PipelineMove = {
  target: 'rejected',
  label: 'Reject',
  success: 'Rejected — the candidate has been emailed.',
  icon: CircleX,
};

const BACK_TO_NEW: PipelineMove = {
  target: 'new',
  label: 'Move back to New',
  success: `Moved back to New — ${TOLD}`,
  icon: Undo2,
};
const BACK_TO_REVIEWING: PipelineMove = {
  target: 'reviewing',
  label: 'Move back to Reviewing',
  success: `Moved back to Reviewing — ${TOLD}`,
  icon: Undo2,
};
const BACK_TO_SHORTLISTED: PipelineMove = {
  target: 'shortlisted',
  label: 'Move back to Shortlisted',
  success: `Moved back to Shortlisted — ${TOLD}`,
  icon: Undo2,
};
const BACK_TO_INTERVIEW: PipelineMove = {
  target: 'interview',
  label: 'Move back to Interview',
  success: `Moved back to Interview — ${TOLD}`,
  icon: Undo2,
};
const REOPEN: PipelineMove = {
  target: 'reviewing',
  label: 'Reopen for review',
  success: `Reopened for review — ${TOLD}`,
  icon: RotateCcw,
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

export function pipelineOutcome(status: PipelineStatus): string | null {
  return OUTCOME[status] ?? null;
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
