import type { components } from '@sync/api-client';
import type { ApplicationStatusTone, StatusTone } from '@sync/ui/components/status-mark';

export type ApplicationSummary = components['schemas']['ApplicationSummary'];
export type TenantApplication = components['schemas']['TenantApplicationSummary'];
export type ApplicationJob = components['schemas']['ApplicationJob'];
export type PipelineStatus = components['schemas']['ApplicationStatus'];
export type ScreeningVerdict = components['schemas']['QualificationStatus'];
export type ScreeningOutcome = components['schemas']['ScreeningVerdict'];
export type ReceivedWithin = components['schemas']['ReceivedWithin'];
export type ApplicationSort = components['schemas']['ApplicationSort'];

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

export const PIPELINE_LADDER = [
  'new',
  'reviewing',
  'shortlisted',
  'interview',
  'offer',
  'hired',
] as const satisfies readonly PipelineStatus[];

export const OPEN_STATUSES = [
  'new',
  'reviewing',
  'shortlisted',
  'interview',
  'offer',
] as const satisfies readonly PipelineStatus[];

export const ENDED_STATUSES = [
  'hired',
  'rejected',
  'withdrawn',
] as const satisfies readonly PipelineStatus[];

/** The two shorthands the Pipeline filter keeps, and which were never stages: `open` is the five
 * an Application is still being decided in, `all` is every one of the eight. They survive only in
 * addresses written before the filter could hold more than one stage. */
export const OPEN_TAB = 'open';

export const ALL_TAB = 'all';

export type PipelineShorthand = typeof OPEN_TAB | typeof ALL_TAB;

export type PipelineTab = PipelineShorthand | PipelineStatus;

export const PIPELINE_TABS = [
  OPEN_TAB,
  ...PIPELINE_STATUSES,
  ALL_TAB,
] as const satisfies readonly PipelineTab[];

export const SCREENING_VERDICTS = [
  'pending',
  'qualified',
  'disqualified',
  'review_required',
] as const satisfies readonly ScreeningVerdict[];

/** How many Applications of a list stand in each Pipeline status, as every list carries them. */
export type StatusCounts = Partial<Record<PipelineStatus, number>>;

export type VerdictCounts = Partial<Record<ScreeningVerdict, number>>;

export function pipelineState(status: PipelineStatus): PipelineState {
  return PIPELINE_STATE[status];
}

export function pipelineStep(status: PipelineStatus): number | null {
  const place = (PIPELINE_LADDER as readonly PipelineStatus[]).indexOf(status);
  return place === -1 ? null : place + 1;
}

/** The stages a list is showing, in Pipeline order however they were chosen — so two Readings
 * naming the same stages are the same Reading, whichever order somebody ticked them in. */
export function pipelineSelection(chosen: PipelineStatus[] | undefined): PipelineStatus[] {
  const named: readonly PipelineStatus[] =
    chosen === undefined || chosen.length === 0 ? OPEN_STATUSES : chosen;
  return PIPELINE_STATUSES.filter((status) => named.includes(status));
}

/** What one of the old single-value addresses meant, as a selection. `open` and `all` were
 * shorthands for a set of stages; one status alone was a set of one. */
export function pipelineFromShorthand(tab: PipelineTab): PipelineStatus[] {
  if (tab === OPEN_TAB) return [...OPEN_STATUSES];
  if (tab === ALL_TAB) return [...PIPELINE_STATUSES];
  return [tab];
}

/** Left out of the address when it is what an untouched list shows, so a plain list has a plain
 * address. */
export function pipelineInAddress(
  chosen: PipelineStatus[] | undefined,
): PipelineStatus[] | undefined {
  const selection = pipelineSelection(chosen);
  return sameStages(selection, OPEN_STATUSES) ? undefined : selection;
}

/** No status at all is what the API reads as every status, so a selection holding all eight asks
 * for none of them by name. */
export function pipelineStatuses(selection: PipelineStatus[]): PipelineStatus[] | undefined {
  return sameStages(selection, PIPELINE_STATUSES) ? undefined : selection;
}

export function holdsOneStatus(selection: PipelineStatus[]): boolean {
  return selection.length === 1;
}

export function showsEveryStage(selection: PipelineStatus[]): boolean {
  return sameStages(selection, PIPELINE_STATUSES);
}

export function showsOpenStages(selection: PipelineStatus[]): boolean {
  return sameStages(selection, OPEN_STATUSES);
}

function sameStages(one: readonly PipelineStatus[], other: readonly PipelineStatus[]): boolean {
  return one.length === other.length && other.every((status) => one.includes(status));
}

export function anythingEnded(counts: StatusCounts): boolean {
  return ENDED_STATUSES.some((status) => (counts[status] ?? 0) > 0);
}

/** How many Applications a set of stages holds, off the counts the list already returned. */
export function stagesCount(stages: readonly PipelineStatus[], counts: StatusCounts): number {
  return stages.reduce((sum, status) => sum + (counts[status] ?? 0), 0);
}

/** The stages of a selection a sweep can actually act on. An Application that has ended cannot
 * move again, so a selection reaching into the ended stages reaches further than any act can. */
export function sweepableStages(selection: PipelineStatus[]): PipelineStatus[] {
  const undecided: readonly PipelineStatus[] = OPEN_STATUSES;
  return selection.filter((status) => undecided.includes(status));
}

export function screeningSelection(chosen: ScreeningVerdict[] | undefined): ScreeningVerdict[] {
  return chosen ?? [...SCREENING_VERDICTS];
}

export function screeningState(verdict: ScreeningVerdict): MarkState {
  return SCREENING_STATE[verdict];
}

const NOT_SCREENED = 'Screening has not run on this Application yet.';

export function screeningExplanation(screening: ScreeningOutcome): string | null {
  if (screening.status === 'pending') return NOT_SCREENED;
  return screening.reason ?? null;
}

export function candidateIdentity(application: ApplicationSummary) {
  return {
    name: application.candidate_name,
    role: application.canonical_role ?? null,
    years: application.total_experience_years,
  };
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

export const APPLICATION_SORTS = [
  'newest',
  'oldest',
  'highest_match',
  'lowest_match',
] as const satisfies readonly ApplicationSort[];

export const DEFAULT_APPLICATION_SORT: ApplicationSort = 'newest';

export function sortSelection(chosen: ApplicationSort | undefined): ApplicationSort {
  return chosen ?? DEFAULT_APPLICATION_SORT;
}

export function sortInAddress(sort: ApplicationSort | undefined): ApplicationSort | undefined {
  return sort === DEFAULT_APPLICATION_SORT ? undefined : sort;
}
