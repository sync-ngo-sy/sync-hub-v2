import type { components } from '@sync/api-client';
import type { StatusTone } from '@sync/ui/components/status-chip';

export type Job = components['schemas']['JobView'];
export type JobSummary = components['schemas']['JobSummary'];
export type JobStatus = components['schemas']['JobStatus'];
export type NewJob = components['schemas']['NewJob'];
export type JobChanges = components['schemas']['JobChanges'];
export type EmploymentType = components['schemas']['EmploymentType'];
export type WorkMode = components['schemas']['WorkMode'];

/** Both fixed sets are the API's, so only the English is written here — a value the platform
 * adds fails to compile until it has a word, and the pickers are these maps in order. */
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
  draft: { label: 'Draft', tone: 'neutral' },
  published: { label: 'Published', tone: 'positive' },
  closed: { label: 'Closed', tone: 'neutral' },
  archived: { label: 'Archived', tone: 'neutral' },
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

const RELATIVE = new Intl.RelativeTimeFormat('en', { numeric: 'always' });
const ABSOLUTE = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' });
const RELATIVE_UNITS: [limit: number, unit: Intl.RelativeTimeFormatUnit][] = [
  [60, 'second'],
  [60, 'minute'],
  [24, 'hour'],
  [30, 'day'],
  [12, 'month'],
  [Number.POSITIVE_INFINITY, 'year'],
];

export function jobRelativeDate(value: string, now: Date = new Date()): string {
  let amount = (new Date(value).getTime() - now.getTime()) / 1_000;
  if (Math.abs(amount) < 60) return 'just now';

  const round = (part: number) => Math.sign(part) * Math.round(Math.abs(part));
  for (const [limit, unit] of RELATIVE_UNITS) {
    if (Math.abs(amount) < limit) return RELATIVE.format(round(amount), unit);
    amount /= limit;
  }
  return RELATIVE.format(round(amount), 'year');
}

export function jobAbsoluteDate(value: string): string {
  return ABSOLUTE.format(new Date(value));
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
