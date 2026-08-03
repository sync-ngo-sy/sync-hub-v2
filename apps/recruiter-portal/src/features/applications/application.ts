import type { components } from '@sync/api-client';
import type { StatusTone } from '@sync/ui/components/status-chip';

export type ApplicationSummary = components['schemas']['ApplicationSummary'];
export type PipelineStatus = components['schemas']['ApplicationStatus'];
export type ScreeningVerdict = components['schemas']['QualificationStatus'];

interface ChipState {
  label: string;
  tone: StatusTone;
}

const PIPELINE_STATE: Record<PipelineStatus, ChipState> = {
  new: { label: 'New', tone: 'neutral' },
  reviewing: { label: 'Reviewing', tone: 'neutral' },
  shortlisted: { label: 'Shortlisted', tone: 'shortlisted' },
  interview: { label: 'Interview', tone: 'interview' },
  offer: { label: 'Offer', tone: 'offer' },
  hired: { label: 'Hired', tone: 'hired' },
  rejected: { label: 'Rejected', tone: 'negative' },
  withdrawn: { label: 'Withdrawn', tone: 'neutral' },
};

const SCREENING_STATE: Record<ScreeningVerdict, ChipState> = {
  pending: { label: 'Pending', tone: 'neutral' },
  qualified: { label: 'Qualified', tone: 'positive' },
  disqualified: { label: 'Disqualified', tone: 'negative' },
  review_required: { label: 'Review required', tone: 'review-required' },
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

export const SCREENING_VERDICTS = [
  'pending',
  'qualified',
  'disqualified',
  'review_required',
] as const satisfies readonly ScreeningVerdict[];

export function pipelineState(status: PipelineStatus): ChipState {
  return PIPELINE_STATE[status];
}

export function screeningState(verdict: ScreeningVerdict): ChipState {
  return SCREENING_STATE[verdict];
}

export function candidateMeta(application: ApplicationSummary): string {
  return [application.headline, application.location].filter(Boolean).join(' · ');
}
