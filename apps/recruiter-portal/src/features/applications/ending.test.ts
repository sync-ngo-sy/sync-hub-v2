import { describe, expect, it } from 'vitest';
import { PIPELINE_STATUSES } from './application';
import {
  actConsequence,
  actDestination,
  actedMessage,
  actLabel,
  actsFor,
  actsOpenTo,
  aFewAtATime,
  endableStatuses,
  endingTotalMessage,
  endsWhatItTicked,
  LADDER_ACTS,
  movedTogether,
  nothingIsOpen,
  TICKED_ACTS,
  tickable,
  tickedLabel,
  whatItSwept,
  whereTickedRowsGo,
} from './ending';

const A_FULL_JOB = {
  new: 4,
  reviewing: 3,
  shortlisted: 2,
  interview: 1,
  offer: 1,
  hired: 1,
  rejected: 9,
  withdrawn: 2,
};

const THE_TELLING = '2026-08-24T10:00:00Z';

describe('the statuses a sweep can end', () => {
  it('offers the five an Application is still being decided in, in Pipeline order', () => {
    expect(endableStatuses(A_FULL_JOB).map((one) => one.status)).toEqual([
      'new',
      'reviewing',
      'shortlisted',
      'interview',
      'offer',
    ]);
  });

  it('names each one as the Pipeline names it, with the count the list already returned', () => {
    expect(endableStatuses(A_FULL_JOB)[0]).toEqual({ status: 'new', label: 'New', count: 4 });
  });

  it('reads a status the counts leave out as none of them, rather than as unknown', () => {
    expect(endableStatuses({ new: 2 }).map((one) => one.count)).toEqual([2, 0, 0, 0, 0]);
  });

  it('offers no status that has ended, whatever the counts say', () => {
    const offered = endableStatuses(A_FULL_JOB).map((one) => one.status);

    expect(offered).not.toContain('hired');
    expect(offered).not.toContain('rejected');
    expect(offered).not.toContain('withdrawn');
  });
});

describe('what one confirm decides', () => {
  it('adds up the ticks, and only the ticks', () => {
    expect(endsWhatItTicked(['new', 'offer'], A_FULL_JOB)).toBe(5);
    expect(endsWhatItTicked([], A_FULL_JOB)).toBe(0);
  });

  it('counts a tick on a status nothing stands in as nothing', () => {
    expect(endsWhatItTicked(['interview'], { new: 4 })).toBe(0);
  });

  it('will not count what the ticks cannot reach', () => {
    expect(endsWhatItTicked(['rejected', 'new'], A_FULL_JOB)).toBe(4);
  });

  it('says how many one confirm decides, and reads a single one as one', () => {
    expect(actLabel('end', 12)).toBe('End 12 Applications');
    expect(actLabel('end', 1)).toBe('End 1 Application');
    expect(actLabel('end', 0)).toBe('End Applications');
  });
});

describe('a Job with nothing left to end', () => {
  it('is one whose five undecided statuses are all empty', () => {
    expect(nothingIsOpen({ hired: 1, rejected: 9, withdrawn: 2 })).toBe(true);
    expect(nothingIsOpen({})).toBe(true);
    expect(nothingIsOpen({ offer: 1, rejected: 9 })).toBe(false);
  });
});

describe('what ticking a row can go on to say', () => {
  it('offers every ladder move but the one the row already stands in, and the ending', () => {
    expect(actsFor('new')).toEqual([
      'to-reviewing',
      'to-shortlisted',
      'to-interview',
      'to-offer',
      'end',
    ]);
    expect(actsFor('shortlisted')).toEqual(['to-reviewing', 'to-interview', 'to-offer', 'end']);
    expect(actsFor('offer')).toEqual(['to-reviewing', 'to-shortlisted', 'to-interview', 'end']);
  });

  it('takes a rejected Application back, and offers nothing else on it', () => {
    expect(actsFor('rejected')).toEqual(['reopen']);
  });

  it('offers nothing at all on an Application nothing moves', () => {
    expect(actsFor('hired')).toEqual([]);
    expect(actsFor('withdrawn')).toEqual([]);
  });

  it('never offers a hire, which names a day one act over many cannot answer', () => {
    for (const status of PIPELINE_STATUSES) {
      expect(actsFor(status).map(whereTickedRowsGo)).not.toContain('hired');
    }
  });

  it('never offers New, which is where an Application arrives rather than where a set is sent', () => {
    expect(LADDER_ACTS.map(whereTickedRowsGo)).not.toContain('new');
  });

  it('names where each act takes the rows it was ticked for', () => {
    expect(whereTickedRowsGo('end')).toBe('rejected');
    expect(whereTickedRowsGo('reopen')).toBe('reviewing');
    expect(whereTickedRowsGo('to-reviewing')).toBe('reviewing');
    expect(whereTickedRowsGo('to-shortlisted')).toBe('shortlisted');
    expect(whereTickedRowsGo('to-interview')).toBe('interview');
    expect(whereTickedRowsGo('to-offer')).toBe('offer');
  });

  it('leaves every act open while nothing is ticked, so the first tick narrows it', () => {
    expect(actsOpenTo([])).toEqual([...TICKED_ACTS]);
  });

  it('keeps only the acts every ticked row admits', () => {
    expect(actsOpenTo(['new'])).toEqual([
      'to-reviewing',
      'to-shortlisted',
      'to-interview',
      'to-offer',
      'end',
    ]);
    expect(actsOpenTo(['new', 'shortlisted'])).toEqual([
      'to-reviewing',
      'to-interview',
      'to-offer',
      'end',
    ]);
    expect(actsOpenTo(['rejected'])).toEqual(['reopen']);
  });

  it('drops a ladder move as soon as one ticked row already stands where it would go', () => {
    expect(actsOpenTo(['new', 'reviewing'])).not.toContain('to-reviewing');
    expect(actsOpenTo(['shortlisted', 'interview'])).not.toContain('to-shortlisted');
  });

  it('offers a box on every row that admits an act while nothing is ticked', () => {
    const nothing = actsOpenTo([]);
    expect(tickable('new', nothing)).toBe(true);
    expect(tickable('rejected', nothing)).toBe(true);
    expect(tickable('hired', nothing)).toBe(false);
    expect(tickable('withdrawn', nothing)).toBe(false);
  });

  it('takes the box off every row that shares no act with what is ticked', () => {
    expect(tickable('new', actsOpenTo(['new']))).toBe(true);
    expect(tickable('rejected', actsOpenTo(['new']))).toBe(false);
    expect(tickable('rejected', actsOpenTo(['rejected']))).toBe(true);
    expect(tickable('new', actsOpenTo(['rejected']))).toBe(false);
  });

  it('keeps a row tickable while it still shares one act, though not the same one', () => {
    expect(tickable('reviewing', actsOpenTo(['new']))).toBe(true);
    expect(actsOpenTo(['new', 'reviewing'])).toContain('to-shortlisted');
  });

  it('says how many rows are ticked, and reads a single one as one', () => {
    expect(tickedLabel(3)).toBe('3 Applications ticked');
    expect(tickedLabel(1)).toBe('1 Application ticked');
  });

  it('names the move back to Reviewing as the move it is', () => {
    expect(actLabel('reopen', 3)).toBe('Move 3 Applications back to Reviewing');
    expect(actLabel('reopen', 1)).toBe('Move 1 Application back to Reviewing');
  });

  it('names a ladder move by where it takes them', () => {
    expect(actLabel('to-shortlisted', 3)).toBe('Move 3 Applications to Shortlisted');
    expect(actLabel('to-interview', 1)).toBe('Move 1 Application to Interview');
    expect(actDestination('to-offer')).toBe('Offer');
  });

  it('promises a ladder move reaches nobody, and says which step is the exception', () => {
    for (const act of LADDER_ACTS) {
      expect(actConsequence(act)).toContain('read as In review');
      expect(actConsequence(act)).toContain('off New');
    }
  });

  it('says what an ending costs, and never confuses it with a ladder move', () => {
    expect(actConsequence('end')).toContain('three days');
    expect(actConsequence('reopen')).toContain('back to Reviewing');
  });
});

describe('what an act reports back', () => {
  const done = (moved: number) => ({ moved, toldAt: THE_TELLING });

  it('says how many ended and the day they hear', () => {
    expect(actedMessage('end', done(12))).toBe(
      '12 Applications ended — they hear on August 24, 2026.',
    );
    expect(actedMessage('end', done(1))).toBe(
      '1 Application ended — they hear on August 24, 2026.',
    );
  });

  it('will not claim an ending where the list had already moved on', () => {
    expect(actedMessage('end', { moved: 0, toldAt: null })).toBe(
      'Nothing was ended — every Application the ticks named had already moved.',
    );
    expect(actedMessage('reopen', { moved: 0, toldAt: null })).toBe(
      'Nothing moved — every Application the ticks named had already moved.',
    );
  });

  it('says which of the ticked rows it missed, and says nothing when it missed none', () => {
    expect(actedMessage('end', done(2), 3)).toBe(
      '2 of 3 Applications ended — the other had already moved.',
    );
    expect(actedMessage('end', done(1), 3)).toBe(
      '1 of 3 Applications ended — the others had already moved.',
    );
    expect(actedMessage('end', done(3), 3)).toBe(
      '3 Applications ended — they hear on August 24, 2026.',
    );
  });

  it('says where a ladder move left them, and claims nothing about anybody hearing', () => {
    expect(actedMessage('to-shortlisted', { moved: 4, toldAt: null })).toBe(
      '4 Applications are in Shortlisted.',
    );
    expect(actedMessage('to-interview', { moved: 1, toldAt: null })).toBe(
      '1 Application is in Interview.',
    );
  });

  it('says which of the ticked rows a ladder move missed', () => {
    expect(actedMessage('to-offer', { moved: 2, toldAt: null }, 3)).toBe(
      '2 of 3 Applications are in Offer — the other had already moved.',
    );
  });

  it('says nothing moved rather than nothing ended, where nothing was being ended', () => {
    expect(actedMessage('to-shortlisted', { moved: 0, toldAt: null })).toBe(
      'Nothing moved — every Application the ticks named had already moved.',
    );
  });

  it('says a move back to Reviewing without claiming anybody was told', () => {
    expect(actedMessage('reopen', done(3))).toBe(
      '3 Applications are back in Reviewing. Anyone who had not been told hears nothing.',
    );
    expect(actedMessage('reopen', done(1))).toBe(
      '1 Application is back in Reviewing. Anyone who had not been told hears nothing.',
    );
    expect(actedMessage('reopen', done(2), 3)).toBe(
      '2 of 3 Applications are back in Reviewing — the other had already moved.',
    );
  });
});

describe('the running total the modal states', () => {
  it('says what one confirm decides, and what the people it decides hear', () => {
    expect(endingTotalMessage(12)).toBe('12 Applications end. They hear three days from now.');
    expect(endingTotalMessage(1)).toBe('1 Application ends. They hear three days from now.');
  });

  it('says nothing is ticked rather than that nothing ends', () => {
    expect(endingTotalMessage(0)).toBe('Nothing is ticked.');
  });
});

describe('rows moved one at a time', () => {
  const moved = (told_at: string | null) => ({
    id: 'a1',
    status: 'rejected' as const,
    previous_status: 'new' as const,
    candidate_notified: false,
    told_at,
    changed_at: '2026-08-21T10:00:00Z',
  });

  it('reads back as one answer, carrying the Telling they were given', () => {
    expect(movedTogether([moved(THE_TELLING), moved(THE_TELLING)])).toEqual({
      moved: 2,
      toldAt: THE_TELLING,
    });
  });

  it('counts only the rows that really moved', () => {
    expect(movedTogether([moved(THE_TELLING), null, null])).toEqual({
      moved: 1,
      toldAt: THE_TELLING,
    });
    expect(movedTogether([null])).toEqual({ moved: 0, toldAt: null });
  });

  it('reads a sweep of statuses back through the same shape', () => {
    expect(whatItSwept({ ended: 4, told_at: THE_TELLING })).toEqual({
      moved: 4,
      toldAt: THE_TELLING,
    });
    expect(whatItSwept({ ended: 0 })).toEqual({ moved: 0, toldAt: null });
  });
});

describe('moving a few rows at a time', () => {
  it('keeps every answer in the order the rows were given', async () => {
    const outcomes = await aFewAtATime([1, 2, 3, 4], async (one) => one * 2, 2);

    expect(outcomes.map((one) => (one.status === 'fulfilled' ? one.value : null))).toEqual([
      2, 4, 6, 8,
    ]);
  });

  it('never has more than a few requests open at once', async () => {
    let open = 0;
    let busiest = 0;

    await aFewAtATime(
      Array.from({ length: 20 }, (_, at) => at),
      async () => {
        open += 1;
        busiest = Math.max(busiest, open);
        await Promise.resolve();
        open -= 1;
      },
      3,
    );

    expect(busiest).toBe(3);
  });

  it('keeps a refusal beside what the rest of them did', async () => {
    const outcomes = await aFewAtATime([1, 2, 3], async (one) => {
      if (one === 2) throw new Error('refused');
      return one;
    });

    expect(outcomes.map((one) => one.status)).toEqual(['fulfilled', 'rejected', 'fulfilled']);
  });
});
