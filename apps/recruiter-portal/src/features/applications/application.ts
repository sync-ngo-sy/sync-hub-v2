import type { components } from '@sync/api-client';
import type { StatusTone } from '@sync/ui/components/status-chip';

export type ApplicationSummary = components['schemas']['ApplicationSummary'];
export type ApplicationStatus = components['schemas']['ApplicationStatus'];
export type QualificationStatus = components['schemas']['QualificationStatus'];

interface ChipState {
  label: string;
  tone: StatusTone;
}

const PIPELINE_STATE: Record<ApplicationStatus, ChipState> = {
  new: { label: 'New', tone: 'neutral' },
  reviewing: { label: 'Reviewing', tone: 'neutral' },
  shortlisted: { label: 'Shortlisted', tone: 'shortlisted' },
  interview: { label: 'Interview', tone: 'interview' },
  offer: { label: 'Offer', tone: 'offer' },
  hired: { label: 'Hired', tone: 'hired' },
  rejected: { label: 'Rejected', tone: 'negative' },
  withdrawn: { label: 'Withdrawn', tone: 'neutral' },
};

const SCREENING_STATE: Record<QualificationStatus, ChipState> = {
  pending: { label: 'Pending', tone: 'neutral' },
  qualified: { label: 'Qualified', tone: 'positive' },
  disqualified: { label: 'Disqualified', tone: 'negative' },
  review_required: { label: 'Review required', tone: 'review-required' },
};

export const PIPELINE_STATUSES = Object.keys(PIPELINE_STATE) as [
  ApplicationStatus,
  ...ApplicationStatus[],
];
export const QUALIFICATION_STATUSES = Object.keys(SCREENING_STATE) as [
  QualificationStatus,
  ...QualificationStatus[],
];

export function pipelineState(status: ApplicationStatus): ChipState {
  return PIPELINE_STATE[status];
}

export function screeningState(status: QualificationStatus): ChipState {
  return SCREENING_STATE[status];
}

export function candidateMeta(application: ApplicationSummary): string {
  return [application.headline, application.location].filter(Boolean).join(' · ');
}
