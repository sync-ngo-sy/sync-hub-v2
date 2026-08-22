import type { components } from '@sync/api-client';
import { absoluteDate } from '@/lib/dates';
import {
  OPEN_STATUSES,
  type PipelineStatus,
  pipelineState,
  type ReceivedWithin,
  type StatusCounts,
  stagesCount,
  sweepableStages,
} from './application';

export type Sweep = components['schemas']['ApplicationSweep'];
export type TenantSweep = components['schemas']['TenantApplicationSweep'];
export type SweptApplications = components['schemas']['SweptApplications'];
type MovedApplication = components['schemas']['MovedApplication'];

/** What a sweep of the Reading on screen would reach.
 *
 * The counts are the `status_counts` the list already returned, so this costs no request of its
 * own — and they are totals for the whole Reading rather than for the page loaded, which is what
 * lets a sweep of fifty thousand say so before anybody confirms it.
 */
export interface SweepScope {
  /** Every Application the Reading is showing. */
  matching: number;
  /** Of those, the ones an act can still move. */
  movable: number;
  /** The rest. They have ended, and nothing moves them again. */
  held: number;
  /** The stages a sweep would name: the Reading's own, less the ones that have ended. */
  stages: PipelineStatus[];
}

export function sweepScope(selection: PipelineStatus[], counts: StatusCounts): SweepScope {
  const stages = sweepableStages(selection);
  const matching = stagesCount(selection, counts);
  const movable = stagesCount(stages, counts);
  return { matching, movable, held: matching - movable, stages };
}

const WHAT_A_SWEEP_REACHES = 'Every act here reaches all of them, not only the page on screen.';

/** What the acts beside the filters will reach, stated whether or not anything is narrowing —
 * because a number nobody explained is a number nobody should act on. */
export function sweepScopeMessage(scope: SweepScope): string {
  if (scope.matching === 0) return 'Nothing matches these filters.';
  if (scope.held === 0) return `Applications match these filters. ${WHAT_A_SWEEP_REACHES}`;
  if (scope.movable === 0) {
    return `of ${scope.matching} matching, and none of them can move: every one has ended.`;
  }
  const others = scope.held === 1 ? 'The other has ended' : `The other ${scope.held} have ended`;
  return `of ${scope.matching} matching can move. ${others}, and nothing moves them again.`;
}

/** Where a sweep can send the Reading, each as the Pipeline names it. The same four rungs a ticked
 * Act offers, and for the same reasons: never `new`, never `hired`. */
export function sweepDestinations(): [PipelineStatus, string][] {
  return LADDER_DESTINATIONS.map((status) => [status, pipelineState(status).label]);
}

/** Where along the ladder a set can be sent, in the order the moves are offered.
 *
 * `new` is not among them, and `hired` cannot be: the first is where an Application arrives rather
 * than somewhere a set is sent, and the second names the day it started, which one act over many
 * Applications has no way to answer.
 */
const LADDER_DESTINATIONS = [
  'reviewing',
  'shortlisted',
  'interview',
  'offer',
] as const satisfies readonly PipelineStatus[];

/** What ticking rows can go on to say. Every act is one Pipeline move made over a set: along the
 * ladder, ending the Applications still being decided, or taking back the ones this Tenant
 * rejected — which is how a sweep is undone.
 *
 * A ladder move is named for where it goes and every name is spelled `to-…`, so no act is ever
 * the same string as a `PipelineStatus`: a status handed to something wanting an act fails to
 * compile rather than reading as the wrong move.
 */
export type LadderAct = `to-${(typeof LADDER_DESTINATIONS)[number]}`;

export type TickedAct = LadderAct | 'end' | 'reopen';

export const LADDER_ACTS: readonly LadderAct[] = LADDER_DESTINATIONS.map(
  (status) => `to-${status}` as const,
);

/** Every act, ladder first, then the ending, then the one act a rejected row admits. */
export const TICKED_ACTS: readonly TickedAct[] = [...LADDER_ACTS, 'end', 'reopen'];

/** Total over the acts, so an act added to the union fails to compile until it says where it
 * takes the rows it was ticked for. */
const WHERE_IT_GOES: Record<TickedAct, PipelineStatus> = {
  'to-reviewing': 'reviewing',
  'to-shortlisted': 'shortlisted',
  'to-interview': 'interview',
  'to-offer': 'offer',
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
  'to-reviewing': WHAT_A_LADDER_MOVE_COSTS,
  'to-shortlisted': WHAT_A_LADDER_MOVE_COSTS,
  'to-interview': WHAT_A_LADDER_MOVE_COSTS,
  'to-offer': WHAT_A_LADDER_MOVE_COSTS,
  end: WHAT_ENDING_COSTS,
  reopen: WHAT_REOPENING_COSTS,
};

const ENDING_REFUSAL =
  "Some of these Applications couldn't be ended. The list has been read again, so it says which.";

const MOVE_REFUSAL =
  "Some of these Applications couldn't be moved. The list has been read again, so it says which.";

const REFUSAL: Record<TickedAct, string> = {
  'to-reviewing': MOVE_REFUSAL,
  'to-shortlisted': MOVE_REFUSAL,
  'to-interview': MOVE_REFUSAL,
  'to-offer': MOVE_REFUSAL,
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

/** One sweep's confirm, and the button that opens it. */
export function sweepLabel(to: PipelineStatus, total: number): string {
  const counted = total === 0 ? 'Applications' : `${total} ${APPLICATIONS(total)}`;
  if (to === 'rejected') return `End ${counted}`;
  return `Move ${counted} to ${pipelineState(to).label}`;
}

/** What the sweep costs the people it is about, stated before anybody confirms it. */
export function sweepConsequence(to: PipelineStatus): string {
  return to === 'rejected' ? WHAT_ENDING_COSTS : WHAT_A_LADDER_MOVE_COSTS;
}

export function sweepRefused(to: PipelineStatus): string {
  return to === 'rejected' ? ENDING_REFUSAL : MOVE_REFUSAL;
}

/** What a sweep says it did. An ending reports through the same sentence a ticked ending does,
 * Telling and all; a move along the ladder reports where they landed and claims nothing about
 * anybody hearing, because nobody did. */
export function sweptMessage(swept: SweptApplications, to: PipelineStatus): string {
  const done = whatItSwept(swept);
  if (to === 'rejected') return actedMessage('end', done);
  if (done.moved === 0) return 'Nothing moved — the list had already moved on.';
  const are = done.moved === 1 ? 'is' : 'are';
  return `${done.moved} ${APPLICATIONS(done.moved)} ${are} in ${pipelineState(to).label}.`;
}

/** The Received window a Tenant-wide sweep carries, as the request spells it. */
export function receivedInSweep(received: ReceivedWithin | undefined): ReceivedWithin | null {
  return received ?? null;
}

/** A sweep's own answer, in the one shape both paths report through. */
export function whatItSwept(swept: SweptApplications): Moved {
  return { moved: swept.moved, toldAt: swept.told_at ?? null };
}

/**
 * Rows moved one at a time, read back as the one answer a sweep gives.
 *
 * Ticked rows are named by id, so each is its own request where a sweep is one. The Telling
 * reported is the first that landed, standing for a set taken seconds apart; a row that had
 * already moved carries none.
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
