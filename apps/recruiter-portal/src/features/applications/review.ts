import type { components } from '@sync/api-client';
import { type PipelineStatus, pipelineState } from './application';

export type ApplicationReview = components['schemas']['ApplicationReview'];
export type Snapshot = components['schemas']['ApplicationSnapshot'];
export type AnsweredQuestion = components['schemas']['AnsweredQuestion'];
export type StatusHistoryEntry = components['schemas']['StatusHistoryEntry'];
type LanguageProficiency = components['schemas']['LanguageProficiency'];
type StatusChangeSource = components['schemas']['StatusChangeSource'];

export interface PipelineMove {
  target: PipelineStatus;
  label: string;
  success: string;
}

const TOLD = 'the candidate has been told.';

const TO_REVIEWING: PipelineMove = {
  target: 'reviewing',
  label: 'Move to Reviewing',
  success: `Moved to Reviewing — ${TOLD}`,
};
const TO_SHORTLISTED: PipelineMove = {
  target: 'shortlisted',
  label: 'Move to Shortlisted',
  success: `Shortlisted — ${TOLD}`,
};
const TO_INTERVIEW: PipelineMove = {
  target: 'interview',
  label: 'Move to Interview',
  success: `Moved to Interview — ${TOLD}`,
};
const TO_OFFER: PipelineMove = {
  target: 'offer',
  label: 'Move to Offer',
  success: `Moved to Offer — ${TOLD}`,
};
const TO_HIRED: PipelineMove = {
  target: 'hired',
  label: 'Mark as hired',
  success: `Marked as hired — ${TOLD}`,
};
const TO_REJECTED: PipelineMove = {
  target: 'rejected',
  label: 'Reject',
  success: 'Rejected — the candidate has been emailed.',
};

const BACK_TO_NEW: PipelineMove = {
  target: 'new',
  label: 'Move back to New',
  success: `Moved back to New — ${TOLD}`,
};
const BACK_TO_REVIEWING: PipelineMove = {
  target: 'reviewing',
  label: 'Move back to Reviewing',
  success: `Moved back to Reviewing — ${TOLD}`,
};
const BACK_TO_SHORTLISTED: PipelineMove = {
  target: 'shortlisted',
  label: 'Move back to Shortlisted',
  success: `Moved back to Shortlisted — ${TOLD}`,
};
const BACK_TO_INTERVIEW: PipelineMove = {
  target: 'interview',
  label: 'Move back to Interview',
  success: `Moved back to Interview — ${TOLD}`,
};
const REOPEN: PipelineMove = {
  target: 'reviewing',
  label: 'Reopen for review',
  success: `Reopened for review — ${TOLD}`,
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

export const LANGUAGE_PROFICIENCY_LABELS: Record<LanguageProficiency, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
  fluent: 'Fluent',
  native: 'Native',
};

const MONTH = new Intl.DateTimeFormat('en', { month: 'short', timeZone: 'UTC' });

export interface SnapshotPeriod {
  start_year?: number | null;
  start_month?: number | null;
  end_year?: number | null;
  end_month?: number | null;
  is_current?: boolean;
}

function monthYear(
  year: number | null | undefined,
  month: number | null | undefined,
): string | null {
  if (year === null || year === undefined) return null;
  if (month === null || month === undefined || month < 1 || month > 12) return String(year);
  return `${MONTH.format(new Date(Date.UTC(2000, month - 1, 1)))} ${year}`;
}

export function period(entry: SnapshotPeriod): string | null {
  const from = monthYear(entry.start_year, entry.start_month);
  const to = entry.is_current ? 'Present' : monthYear(entry.end_year, entry.end_month);
  if (from && to) return `${from} – ${to}`;
  return from ?? to ?? null;
}

export function linkLabel(url: string): string {
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
}

export function yearsOfExperience(years: number): string {
  if (years < 1) return 'Under a year';
  return years === 1 ? '1 year' : `${years} years`;
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
