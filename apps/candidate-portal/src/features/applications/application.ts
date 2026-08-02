import type { components } from '@sync/api-client';
import type { StatusTone } from '@sync/ui/components/status-chip';
import { employmentTypeLabel, workModeLabel } from '@/features/jobs/job';

export type Application = components['schemas']['Application'];
export type ApplicationStatus = components['schemas']['ApplicationStatus'];
export type NewApplication = components['schemas']['NewApplication'];
export type PublicJobQuestion = components['schemas']['PublicJobQuestion'];

interface ApplicationState {
  label: string;
  tone: StatusTone;
}

const APPLICATION_STATE: Record<ApplicationStatus, ApplicationState> = {
  new: { label: 'Submitted', tone: 'neutral' },
  reviewing: { label: 'Reviewing', tone: 'neutral' },
  shortlisted: { label: 'Shortlisted', tone: 'shortlisted' },
  interview: { label: 'Interview', tone: 'interview' },
  offer: { label: 'Offer', tone: 'offer' },
  hired: { label: 'Hired', tone: 'hired' },
  rejected: { label: 'Not selected', tone: 'negative' },
  withdrawn: { label: 'Withdrawn', tone: 'neutral' },
};

export function applicationState(status: ApplicationStatus): ApplicationState {
  return APPLICATION_STATE[status];
}

export function applicationMeta(application: Application): string {
  return [
    application.job.tenant.name,
    application.job.location_name,
    workModeLabel(application.job.work_mode),
    employmentTypeLabel(application.job.employment_type),
  ]
    .filter((part): part is string => Boolean(part))
    .join(' · ');
}

export function canWithdraw(status: ApplicationStatus): boolean {
  return ['new', 'reviewing', 'shortlisted', 'interview', 'offer'].includes(status);
}
