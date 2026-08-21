import type { components } from '@sync/api-client';
import { absoluteDate } from '@/lib/dates';
import {
  OPEN_STATUSES,
  type PipelineStatus,
  pipelineState,
  type StatusCounts,
} from './application';

export type Sweep = components['schemas']['ApplicationSweep'];
export type SweptApplications = components['schemas']['SweptApplications'];
type MovedApplication = components['schemas']['MovedApplication'];

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

/** What ticking rows can go on to say. Two acts and no others: ending the Applications still being
 * decided, and taking back the ones this Tenant rejected — which is how a sweep is undone. */
export type TickedAct = 'end' | 'reopen';

const WHERE_IT_GOES: Record<TickedAct, PipelineStatus> = {
  end: 'rejected',
  reopen: 'reviewing',
};

/** The act a row's own status admits, if any. A hired or a withdrawn Application admits neither:
 * one is done, and the other was the Candidate's own move. */
export function actFor(status: PipelineStatus): TickedAct | null {
  if ((OPEN_STATUSES as readonly PipelineStatus[]).includes(status)) return 'end';
  return status === 'rejected' ? 'reopen' : null;
}

/** Which act the ticks are a statement about. The first tick decides it, and every row that would
 * mean the other act loses its box — so a set of ticks can never mean two things at once. */
export function tickedAct(ticked: PipelineStatus[]): TickedAct | null {
  for (const status of ticked) {
    const act = actFor(status);
    if (act) return act;
  }
  return null;
}

export function tickable(status: PipelineStatus, act: TickedAct | null): boolean {
  const its = actFor(status);
  return its !== null && (act === null || act === its);
}

export function whereTickedRowsGo(act: TickedAct): PipelineStatus {
  return WHERE_IT_GOES[act];
}

const WHAT_ENDING_COSTS =
  'They are rejected, and they hear three days from now. Until then nothing has reached them, ' +
  'and moving one back to Reviewing inside those three days cancels it.';

const WHAT_REOPENING_COSTS =
  'They go back to Reviewing, waiting on a decision again. Anyone who had not been told hears ' +
  'nothing and their queued email is cancelled; anyone who had already read the rejection is ' +
  'told nothing about this, so message them by hand if they should know.';

const CONSEQUENCE: Record<TickedAct, string> = {
  end: WHAT_ENDING_COSTS,
  reopen: WHAT_REOPENING_COSTS,
};

const REFUSED: Record<TickedAct, string> = {
  end: "Some of these Applications couldn't be ended. The list has been read again, so it says which.",
  reopen:
    "Some of these Applications couldn't be moved. The list has been read again, so it says which.",
};

/** What the act costs the people it is about, stated before anybody confirms it. */
export function actConsequence(act: TickedAct): string {
  return CONSEQUENCE[act];
}

export function actRefused(act: TickedAct): string {
  return REFUSED[act];
}

/** What one act did: how many Applications really moved, and the Telling they now carry. */
export interface Moved {
  moved: number;
  toldAt: string | null;
}

const APPLICATIONS = (count: number) => (count === 1 ? 'Application' : 'Applications');

export function actLabel(act: TickedAct, total: number): string {
  const counted = total === 0 ? 'Applications' : `${total} ${APPLICATIONS(total)}`;
  return act === 'end' ? `End ${counted}` : `Move ${counted} back to Reviewing`;
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

/** A sweep's own answer, in the one shape both paths report through. */
export function whatItSwept(swept: SweptApplications): Moved {
  return { moved: swept.ended, toldAt: swept.told_at ?? null };
}

/**
 * Rows moved one at a time, read back as the one answer a sweep gives.
 *
 * The Tenant-wide list has no sweep — a statement about forty Jobs at once is a statement about
 * nothing — so ticking rows there is that many moves. The Telling reported is the first one that
 * landed, standing for a set taken seconds apart; a row that had already moved carries none.
 */
export function movedTogether(moves: (MovedApplication | null)[]): Moved {
  const done = moves.filter((moved) => moved !== null);
  return { moved: done.length, toldAt: done[0]?.told_at ?? null };
}

/**
 * What an act reports back: how many really moved, and — where it ended them — the day they hear.
 *
 * `asked` is how many the Recruiter ticked, where they ticked rows rather than statuses. Fewer
 * moved than that means the list had moved under them: somebody hired one, or a Candidate withdrew.
 * That is worth saying rather than rounding away.
 */
export function actedMessage(act: TickedAct, done: Moved, asked?: number): string {
  if (done.moved === 0) {
    const nothing = act === 'end' ? 'Nothing was ended' : 'Nothing moved';
    return `${nothing} — every Application the ticks named had already moved.`;
  }
  if (asked !== undefined && asked > done.moved) {
    const missed = asked - done.moved;
    const did = act === 'end' ? 'ended' : 'are back in Reviewing';
    return (
      `${done.moved} of ${asked} ${APPLICATIONS(asked)} ${did} — ` +
      `the ${missed === 1 ? 'other' : 'others'} had already moved.`
    );
  }
  const many = `${done.moved} ${APPLICATIONS(done.moved)}`;
  if (act === 'reopen') {
    const are = done.moved === 1 ? 'is' : 'are';
    return `${many} ${are} back in Reviewing. Anyone who had not been told hears nothing.`;
  }
  const day = done.toldAt ? ` — they hear on ${absoluteDate(done.toldAt)}` : '';
  return `${many} ended${day}.`;
}

/** How many moves are in flight at once. A tick is one request, and a reader who ticked a whole
 * loaded page should not open a hundred of them on a single click. */
export const A_FEW = 6;

/** Every item through `each`, a few at a time, answering in the order they were given — and every
 * outcome kept, so one refusal cannot hide what the rest of them did. */
export async function aFewAtATime<TItem, TResult>(
  items: TItem[],
  each: (item: TItem) => Promise<TResult>,
  atOnce: number = A_FEW,
): Promise<PromiseSettledResult<TResult>[]> {
  const outcomes: PromiseSettledResult<TResult>[] = [];
  let next = 0;

  async function take(): Promise<void> {
    while (next < items.length) {
      const at = next;
      next += 1;
      outcomes[at] = await each(items[at] as TItem).then(
        (value) => ({ status: 'fulfilled', value }) as const,
        (reason: unknown) => ({ status: 'rejected', reason }) as const,
      );
    }
  }

  await Promise.all(Array.from({ length: Math.min(atOnce, items.length) }, take));
  return outcomes;
}
