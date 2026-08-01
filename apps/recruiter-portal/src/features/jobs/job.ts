import type { components } from '@sync/api-client';
import type { StatusTone } from '@sync/ui/components/status-chip';

export type Job = components['schemas']['JobView'];
export type JobSummary = components['schemas']['JobSummary'];
export type JobStatus = components['schemas']['JobStatus'];
export type NewJob = components['schemas']['NewJob'];
export type JobChanges = components['schemas']['JobChanges'];

interface JobState {
  label: string;
  tone: StatusTone;
}

const JOB_STATE: Record<JobStatus, JobState> = {
  draft: { label: 'Draft', tone: 'neutral' },
  published: { label: 'Published', tone: 'positive' },
  closed: { label: 'Closed', tone: 'neutral' },
  archived: { label: 'Archived', tone: 'neutral' },
};

export function jobState(status: JobStatus): JobState {
  return JOB_STATE[status];
}

export function jobMeta(job: JobSummary): string {
  return [job.location, job.employment_type].filter(Boolean).join(' · ') || 'Details not set';
}

const DATES = new Intl.DateTimeFormat('en', { dateStyle: 'medium' });

export function jobDate(value: string): string {
  return DATES.format(new Date(value));
}

export interface JobLifecycleAction {
  label: string;
  target: JobStatus;
  success: string;
}

const ARCHIVE: JobLifecycleAction = {
  label: 'Archive job',
  target: 'archived',
  success: 'Job archived',
};

const JOB_LIFECYCLE: Record<JobStatus, JobLifecycleAction[]> = {
  draft: [{ label: 'Publish job', target: 'published', success: 'Job published' }, ARCHIVE],
  published: [{ label: 'Close job', target: 'closed', success: 'Job closed' }, ARCHIVE],
  closed: [{ label: 'Reopen job', target: 'published', success: 'Job reopened' }, ARCHIVE],
  archived: [],
};

export function jobLifecycleActions(status: JobStatus): JobLifecycleAction[] {
  return JOB_LIFECYCLE[status];
}
