import type { components } from '@sync/api-client';
import type { StatusTone } from '@sync/ui/components/status-mark';

export type Job = components['schemas']['JobView'];
export type JobSummary = components['schemas']['JobSummary'];
export type JobStatus = components['schemas']['JobStatus'];
export type JobSort = components['schemas']['JobSort'];
export type NewJob = components['schemas']['NewJob'];
export type JobChanges = components['schemas']['JobChanges'];
export type EmploymentType = components['schemas']['EmploymentType'];
export type WorkMode = components['schemas']['WorkMode'];

export const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  full_time: 'Full time',
  part_time: 'Part time',
  contract: 'Contract',
  temporary: 'Temporary',
  internship: 'Internship',
  volunteer: 'Volunteer',
};

export const WORK_MODE_LABELS: Record<WorkMode, string> = {
  onsite: 'On-site',
  hybrid: 'Hybrid',
  remote: 'Remote',
};

export function employmentTypeLabel(type: EmploymentType | null | undefined): string | null {
  return type ? EMPLOYMENT_TYPE_LABELS[type] : null;
}

export function workModeLabel(mode: WorkMode | null | undefined): string | null {
  return mode ? WORK_MODE_LABELS[mode] : null;
}

interface JobState {
  label: string;
  tone: StatusTone;
}

const JOB_STATE: Record<JobStatus, JobState> = {
  draft: { label: 'Draft', tone: 'waiting' },
  published: { label: 'Published', tone: 'active' },
  closed: { label: 'Closed', tone: 'ended' },
  archived: { label: 'Archived', tone: 'ended' },
};

export function jobState(status: JobStatus): JobState {
  return JOB_STATE[status];
}

export function jobMeta(job: JobSummary): string {
  return (
    [job.location_name, workModeLabel(job.work_mode), employmentTypeLabel(job.employment_type)]
      .filter(Boolean)
      .join(' · ') || 'Details not set'
  );
}

export const JOB_SORTS: Record<JobSort, string> = {
  newest: 'Newest first',
  oldest: 'Oldest first',
  applications: 'Most applications',
};

export const DEFAULT_JOB_SORT: JobSort = 'newest';

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
