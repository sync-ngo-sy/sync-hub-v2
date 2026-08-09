import type { components } from '@sync/api-client';
import type { ApplicationStatusTone, StatusTone } from '@sync/ui/components/status-mark';

export type ApplicationSummary = components['schemas']['ApplicationSummary'];
export type TenantApplication = components['schemas']['TenantApplicationSummary'];
export type ApplicationJob = components['schemas']['ApplicationJob'];
export type PipelineStatus = components['schemas']['ApplicationStatus'];
export type ScreeningVerdict = components['schemas']['QualificationStatus'];
export type ReceivedWithin = components['schemas']['ReceivedWithin'];

interface MarkState {
  label: string;
  tone: StatusTone;
}

interface PipelineState {
  label: string;
  tone: ApplicationStatusTone;
}

const PIPELINE_STATE: Record<PipelineStatus, PipelineState> = {
  new: { label: 'New', tone: 'new' },
  reviewing: { label: 'Reviewing', tone: 'reviewing' },
  shortlisted: { label: 'Shortlisted', tone: 'shortlisted' },
  interview: { label: 'Interview', tone: 'interview' },
  offer: { label: 'Offer', tone: 'offer' },
  hired: { label: 'Hired', tone: 'hired' },
  rejected: { label: 'Rejected', tone: 'rejected' },
  withdrawn: { label: 'Withdrawn', tone: 'withdrawn' },
};

const SCREENING_STATE: Record<ScreeningVerdict, MarkState> = {
  pending: { label: 'Pending', tone: 'waiting' },
  qualified: { label: 'Qualified', tone: 'active' },
  disqualified: { label: 'Disqualified', tone: 'ended' },
  review_required: { label: 'Review required', tone: 'attention' },
};

export const PIPELINE_STATUSES = [
  'new',
  'reviewing',
  'shortlisted',
  'interview',
  'offer',
  'hired',
  'rejected',
  'withdrawn',
] as const satisfies readonly PipelineStatus[];

export const ACTIVE_PIPELINE_STATUSES = [
  'new',
  'reviewing',
  'shortlisted',
  'interview',
  'offer',
  'hired',
] as const satisfies readonly PipelineStatus[];

export const SCREENING_VERDICTS = [
  'pending',
  'qualified',
  'disqualified',
  'review_required',
] as const satisfies readonly ScreeningVerdict[];

export function pipelineState(status: PipelineStatus): PipelineState {
  return PIPELINE_STATE[status];
}

export function pipelineSelection(chosen: PipelineStatus[] | undefined): PipelineStatus[] {
  return chosen ?? [...ACTIVE_PIPELINE_STATUSES];
}

export function screeningSelection(chosen: ScreeningVerdict[] | undefined): ScreeningVerdict[] {
  return chosen ?? [...SCREENING_VERDICTS];
}

export function screeningState(verdict: ScreeningVerdict): MarkState {
  return SCREENING_STATE[verdict];
}

export function candidateMeta(application: ApplicationSummary): string {
  return [application.headline, application.location].filter(Boolean).join(' · ');
}

export const EVERY_TIME = 'ever';

export type ReceivedRange = ReceivedWithin | typeof EVERY_TIME;

export const RECEIVED_RANGES: Record<ReceivedRange, string> = {
  '24h': 'Last 24 hours',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  ever: 'All time',
};

export const RECEIVED_WITHIN_VALUES = [
  '24h',
  '7d',
  '30d',
] as const satisfies readonly ReceivedWithin[];

export function receivedSelection(chosen: ReceivedWithin | undefined): ReceivedRange {
  return chosen ?? EVERY_TIME;
}

export function receivedWithin(range: ReceivedRange): ReceivedWithin | undefined {
  return range === EVERY_TIME ? undefined : range;
}

export function hiddenBehind<TValue extends string>(
  all: readonly TValue[],
  selected: TValue[],
  counts: Partial<Record<TValue, number>>,
): number {
  return all
    .filter((one) => !selected.includes(one))
    .reduce((sum, one) => sum + (counts[one] ?? 0), 0);
}
