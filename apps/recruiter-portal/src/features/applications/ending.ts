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

export interface SweepScope {
  matching: number;
  movable: number;
  held: number;
  stages: PipelineStatus[];
}

export function sweepScope(selection: PipelineStatus[], counts: StatusCounts): SweepScope {
  const stages = sweepableStages(selection);
  const matching = stagesCount(selection, counts);
  const movable = stagesCount(stages, counts);
  return { matching, movable, held: matching - movable, stages };
}

const WHAT_A_SWEEP_REACHES = 'Every act here reaches all of them, not only the page on screen.';

export function sweepScopeMessage(scope: SweepScope): string {
  if (scope.matching === 0) return 'Nothing matches these filters.';
  if (scope.held === 0) return `Applications match these filters. ${WHAT_A_SWEEP_REACHES}`;
  if (scope.movable === 0) {
    return `of ${scope.matching} matching, and none of them can move: every one has ended.`;
  }
  const others = scope.held === 1 ? 'The other has ended' : `The other ${scope.held} have ended`;
  return `of ${scope.matching} matching can move. ${others}, and nothing moves them again.`;
}

export function sweepDestinations(): [PipelineStatus, string][] {
  return LADDER_DESTINATIONS.map((status) => [status, pipelineState(status).label]);
}

const LADDER_DESTINATIONS = [
  'reviewing',
  'shortlisted',
  'interview',
  'offer',
] as const satisfies readonly PipelineStatus[];

export type LadderAct = `to-${(typeof LADDER_DESTINATIONS)[number]}`;

export type TickedAct = LadderAct | 'end' | 'reopen';

export const LADDER_ACTS: readonly LadderAct[] = LADDER_DESTINATIONS.map(
  (status) => `to-${status}` as const,
);

export const TICKED_ACTS: readonly TickedAct[] = [...LADDER_ACTS, 'end', 'reopen'];

const WHERE_IT_GOES: Record<TickedAct, PipelineStatus> = {
  'to-reviewing': 'reviewing',
  'to-shortlisted': 'shortlisted',
  'to-interview': 'interview',
  'to-offer': 'offer',
  end: 'rejected',
  reopen: 'reviewing',
};

export function actsFor(status: PipelineStatus): TickedAct[] {
  if ((OPEN_STATUSES as readonly PipelineStatus[]).includes(status)) {
    return [...LADDER_ACTS.filter((act) => WHERE_IT_GOES[act] !== status), 'end'];
  }
  return status === 'rejected' ? ['reopen'] : [];
}

export function actsOpenTo(ticked: PipelineStatus[]): TickedAct[] {
  return TICKED_ACTS.filter((act) => ticked.every((status) => actsFor(status).includes(act)));
}

export function tickable(status: PipelineStatus, open: TickedAct[]): boolean {
  return actsFor(status).some((act) => open.includes(act));
}

export function whereTickedRowsGo(act: TickedAct): PipelineStatus {
  return WHERE_IT_GOES[act];
}

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

export function actConsequence(act: TickedAct): string {
  return CONSEQUENCE[act];
}

export function actRefused(act: TickedAct): string {
  return REFUSAL[act];
}

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

function landed(act: TickedAct, moved: number): string {
  if (act === 'end') return 'ended';
  const are = moved === 1 ? 'is' : 'are';
  return act === 'reopen' ? `${are} back in Reviewing` : `${are} in ${actDestination(act)}`;
}

export function tickedLabel(ticked: number): string {
  return `${ticked} ${APPLICATIONS(ticked)} ticked`;
}

export function sweepLabel(to: PipelineStatus, total: number): string {
  const counted = total === 0 ? 'Applications' : `${total} ${APPLICATIONS(total)}`;
  if (to === 'rejected') return `End ${counted}`;
  return `Move ${counted} to ${pipelineState(to).label}`;
}

export function sweepConsequence(to: PipelineStatus): string {
  return to === 'rejected' ? WHAT_ENDING_COSTS : WHAT_A_LADDER_MOVE_COSTS;
}

export function sweepRefused(to: PipelineStatus): string {
  return to === 'rejected' ? ENDING_REFUSAL : MOVE_REFUSAL;
}

export function sweptMessage(swept: SweptApplications, to: PipelineStatus): string {
  const done = whatItSwept(swept);
  if (to === 'rejected') return actedMessage('end', done);
  if (done.moved === 0) return 'Nothing moved — the list had already moved on.';
  const are = done.moved === 1 ? 'is' : 'are';
  return `${done.moved} ${APPLICATIONS(done.moved)} ${are} in ${pipelineState(to).label}.`;
}

export function receivedInSweep(received: ReceivedWithin | undefined): ReceivedWithin | null {
  return received ?? null;
}

export function whatItSwept(swept: SweptApplications): Moved {
  return { moved: swept.moved, toldAt: swept.told_at ?? null };
}

export function movedTogether(moves: (MovedApplication | null)[]): Moved {
  const done = moves.filter((moved) => moved !== null);
  return { moved: done.length, toldAt: done[0]?.told_at ?? null };
}

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

export const A_FEW = 6;

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
