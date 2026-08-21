import type { components } from '@sync/api-client';
import { absoluteDate } from '@/lib/dates';
import { OPEN_STATUSES, type PipelineStatus, pipelineState } from './application';

export type Sweep = components['schemas']['ApplicationSweep'];
export type SweptApplications = components['schemas']['SweptApplications'];
type MovedApplication = components['schemas']['MovedApplication'];

type StatusCounts = Partial<Record<PipelineStatus, number>>;

/** One status a sweep can end, and how many of the list the Recruiter is reading stand in it. */
export interface EndableStatus {
  status: PipelineStatus;
  label: string;
  count: number;
}

/** The five statuses an Application is still being decided in, each with its own count.
 *
 * The counts are the `status_counts` the list already returned, so choosing against them costs
 * no request of its own — and they are narrowed by every filter but the Pipeline tab, which is
 * exactly what the ticks replace.
 */
export function endableStatuses(counts: StatusCounts): EndableStatus[] {
  return OPEN_STATUSES.map((status) => ({
    status,
    label: pipelineState(status).label,
    count: counts[status] ?? 0,
  }));
}

/** How many Applications one confirm decides. A tick on anything that has ended reaches nothing,
 * which is what the API says about the same request. */
export function endsWhatItTicked(ticked: PipelineStatus[], counts: StatusCounts): number {
  return endableStatuses(counts)
    .filter((one) => ticked.includes(one.status))
    .reduce((total, one) => total + one.count, 0);
}

/** Whether there is anything left to end at all — every undecided status empty. */
export function nothingIsOpen(counts: StatusCounts): boolean {
  return endableStatuses(counts).every((one) => one.count === 0);
}

/** Whether a row is one a tick means anything on: an Application that has ended cannot end again. */
export function stillOpen(status: PipelineStatus): boolean {
  return (OPEN_STATUSES as readonly PipelineStatus[]).includes(status);
}

const APPLICATIONS = (count: number) => (count === 1 ? 'Application' : 'Applications');

export function endLabel(total: number): string {
  return total === 0 ? 'End Applications' : `End ${total} ${APPLICATIONS(total)}`;
}

export function tickedLabel(ticked: number): string {
  return `${ticked} ${APPLICATIONS(ticked)} ticked`;
}

/** The running total, as the modal states it before anybody confirms. */
export function endingTotalMessage(total: number): string {
  if (total === 0) return 'Nothing is ticked.';
  const end = total === 1 ? 'ends' : 'end';
  return `${total} ${APPLICATIONS(total)} ${end}. They hear three days from now.`;
}

/**
 * Rows ended one move at a time, read back as the one answer a sweep gives.
 *
 * The Tenant-wide list has no sweep — a statement about forty Jobs at once is a statement about
 * nothing — so ticking rows there is that many moves. They all carry the same Telling, so the
 * first one that landed says when everybody hears; a row that had already moved carries none.
 */
export function sweptTogether(moves: (MovedApplication | null)[]): SweptApplications {
  const ended = moves.filter((moved) => moved !== null);
  return { ended: ended.length, told_at: ended[0]?.told_at ?? null };
}

/**
 * What an ending reports back: how many really ended, and the day the people it ended hear.
 *
 * `asked` is how many the Recruiter ticked, where they ticked rows rather than statuses. Fewer
 * ended than that means the list had moved under them — somebody hired one, or a Candidate
 * withdrew — which is worth saying rather than rounding away.
 */
export function endedMessage(swept: SweptApplications, asked?: number): string {
  if (swept.ended === 0) {
    return 'Nothing was ended — every Application the ticks named had already moved.';
  }
  const missed = asked === undefined ? 0 : asked - swept.ended;
  if (missed > 0) {
    return (
      `${swept.ended} of ${asked} ${APPLICATIONS(asked ?? 0)} ended — ` +
      `the ${missed === 1 ? 'other' : 'others'} had already moved.`
    );
  }
  const day = swept.told_at ? absoluteDate(swept.told_at) : null;
  const hear = day ? ` — they hear on ${day}.` : '.';
  return `${swept.ended} ${APPLICATIONS(swept.ended)} ended${hear}`;
}
