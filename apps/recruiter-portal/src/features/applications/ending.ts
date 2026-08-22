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

/** What ticking rows can go on to say. Every act is one Pipeline move made over a set: along the
 * ladder, ending the Applications still being decided, or taking back the ones this Tenant
 * rejected — which is how a sweep is undone. */
export type TickedAct = 'review' | 'shortlist' | 'interview' | 'offer' | 'end' | 'reopen';

/** The moves along the ladder, in the order they are offered.
 *
 * `new` is not among them, and `hired` cannot be: the first is where an Application arrives rather
 * than somewhere a set is sent, and the second names the day it started, which one act over many
 * Applications has no way to answer.
 */
export const LADDER_ACTS = [
  'review',
  'shortlist',
  'interview',
  'offer',
] as const satisfies readonly TickedAct[];

/** Every act, ladder first, then the ending, then the one act a rejected row admits. */
export const TICKED_ACTS = [
  ...LADDER_ACTS,
  'end',
  'reopen',
] as const satisfies readonly TickedAct[];

const WHERE_IT_GOES: Record<TickedAct, PipelineStatus> = {
  review: 'reviewing',
  shortlist: 'shortlisted',
  interview: 'interview',
  offer: 'offer',
  end: 'rejected',
  reopen: 'reviewing',
};

/** The acts a row's own status admits: every ladder move but the one it already stands in, and the
 * ending, while it is still being decided — and only the way back once it has been rejected. A
 * hired or a withdrawn Application admits none: one is done, and the other was the Candidate's own
 * move. Every act here is a move the API's own state machine allows, so an act offered here is
 * never one the pipeline then refuses.
 */
export function actsFor(status: PipelineStatus): TickedAct[] {
  if ((OPEN_STATUSES as readonly PipelineStatus[]).includes(status)) {
    return [...LADDER_ACTS.filter((act) => WHERE_IT_GOES[act] !== status), 'end'];
  }
  return status === 'rejected' ? ['reopen'] : [];
}

/** The acts a set of ticks still leaves open: the ones every ticked row admits, so no act is
 * offered that some row in the set would refuse.
 *
 * Nothing ticked leaves all of them open, which is what lets the first tick narrow rather than
 * decide. A row sharing no act with the set loses its box, so a set of ticks can never mean two
 * things at once — and an act stops being offered as soon as one ticked row already stands where
 * it would go, because a move to where a row already is is not a move.
 */
export function actsOpenTo(ticked: PipelineStatus[]): TickedAct[] {
  return TICKED_ACTS.filter((act) => ticked.every((status) => actsFor(status).includes(act)));
}

/** Whether a tick is offered on a row: it admits some act, and one the set still leaves open. */
export function tickable(status: PipelineStatus, open: TickedAct[]): boolean {
  return actsFor(status).some((act) => open.includes(act));
}

export function whereTickedRowsGo(act: TickedAct): PipelineStatus {
  return WHERE_IT_GOES[act];
}

/** The act as a menu names it: where the rows go, and nothing else — how many are ticked has
 * already been said beside it. */
export function actDestination(act: TickedAct): string {
  return pipelineState(WHERE_IT_GOES[act]).label;
}

const WHAT_ENDING_COSTS =
  'They are rejected, and they hear three days from now. Until then nothing has reached them, ' +
  'and moving one back to Reviewing inside those three days cancels it.';

const WHAT_REOPENING_COSTS =
  'They go back to Reviewing, waiting on a decision again. Anyone who had not been told hears ' +
  'nothing and their queued email is cancelled; anyone who had already read the rejection is ' +
  'told nothing about this, so message them by hand if they should know.';

/** A ladder move is the one act that costs the Candidate nothing, and the Stage is why: Reviewing,
 * Shortlisted, Interview and Offer are one Stage to them, so moving between them is silent. Only
 * the step off New crosses a Stage boundary, and that is the whole of what it says. */
const WHAT_A_LADDER_MOVE_COSTS =
  'Nothing is sent about where they stand on your ladder: Reviewing, Shortlisted, Interview and ' +
  'Offer all read as In review to the Candidate. Moving one off New tells them their Application ' +
  'is in review, and that is the whole of what anybody hears.';

const CONSEQUENCE: Record<TickedAct, string> = {
  review: WHAT_A_LADDER_MOVE_COSTS,
  shortlist: WHAT_A_LADDER_MOVE_COSTS,
  interview: WHAT_A_LADDER_MOVE_COSTS,
  offer: WHAT_A_LADDER_MOVE_COSTS,
  end: WHAT_ENDING_COSTS,
  reopen: WHAT_REOPENING_COSTS,
};

const ENDING_REFUSAL =
  "Some of these Applications couldn't be ended. The list has been read again, so it says which.";

const MOVE_REFUSAL =
  "Some of these Applications couldn't be moved. The list has been read again, so it says which.";

const REFUSAL: Record<TickedAct, string> = {
  review: MOVE_REFUSAL,
  shortlist: MOVE_REFUSAL,
  interview: MOVE_REFUSAL,
  offer: MOVE_REFUSAL,
  end: ENDING_REFUSAL,
  reopen: MOVE_REFUSAL,
};

/** What the act costs the people it is about, stated before anybody confirms it. */
export function actConsequence(act: TickedAct): string {
  return CONSEQUENCE[act];
}

export function actRefused(act: TickedAct): string {
  return REFUSAL[act];
}

/** What one act did: how many Applications really moved, and the Telling they now carry. */
export interface Moved {
  moved: number;
  toldAt: string | null;
}

const APPLICATIONS = (count: number) => (count === 1 ? 'Application' : 'Applications');

export function actLabel(act: TickedAct, total: number): string {
  const counted = total === 0 ? 'Applications' : `${total} ${APPLICATIONS(total)}`;
  if (act === 'end') return `End ${counted}`;
  if (act === 'reopen') return `Move ${counted} back to Reviewing`;
  return `Move ${counted} to ${actDestination(act)}`;
}

/** Where the act left the rows, as a sentence says it afterwards. */
function landed(act: TickedAct, moved: number): string {
  if (act === 'end') return 'ended';
  const are = moved === 1 ? 'is' : 'are';
  return act === 'reopen' ? `${are} back in Reviewing` : `${are} in ${actDestination(act)}`;
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
    return (
      `${done.moved} of ${asked} ${APPLICATIONS(asked)} ${landed(act, done.moved)} — ` +
      `the ${missed === 1 ? 'other' : 'others'} had already moved.`
    );
  }
  const many = `${done.moved} ${APPLICATIONS(done.moved)}`;
  if (act === 'reopen') {
    return `${many} ${landed(act, done.moved)}. Anyone who had not been told hears nothing.`;
  }
  if (act !== 'end') {
    return `${many} ${landed(act, done.moved)}.`;
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
