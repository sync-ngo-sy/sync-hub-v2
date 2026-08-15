import type { components } from '@sync/api-client';
import type { ApplicationStatusTone } from '@sync/ui/components/status-mark';
import { employmentTypeLabel, workModeLabel } from '@/features/jobs/job';

export type Application = components['schemas']['Application'];
export type ApplicationStage = components['schemas']['ApplicationStage'];
export type ClaimedHire = components['schemas']['ClaimedHire'];
export type NewApplication = components['schemas']['NewApplication'];
export type PublicJobQuestion = components['schemas']['PublicJobQuestion'];

interface ApplicationState {
  label: string;
  tone: ApplicationStatusTone;
}

const APPLICATION_STATE: Record<ApplicationStage, ApplicationState> = {
  received: { label: 'Received', tone: 'new' },
  in_review: { label: 'In review', tone: 'reviewing' },
  hired: { label: 'Hired', tone: 'hired' },
  not_selected: { label: 'Not selected', tone: 'rejected' },
  withdrawn: { label: 'Withdrawn', tone: 'withdrawn' },
};

export function applicationState(stage: ApplicationStage): ApplicationState {
  return APPLICATION_STATE[stage];
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

export function unansweredHire(application: Application): ClaimedHire | null {
  const hire = application.hire;
  return hire && hire.confirmation === 'unanswered' ? hire : null;
}

export function hireAnswerLine(hire: ClaimedHire): string | null {
  if (hire.confirmation === 'confirmed') return 'You confirmed you started this job.';
  if (hire.confirmation === 'denied') return "You said you didn't start this job.";
  return null;
}
