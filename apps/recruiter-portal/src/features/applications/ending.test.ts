import { describe, expect, it } from 'vitest';
import { PIPELINE_STATUSES } from './application';
import {
  actConsequence,
  actDestination,
  actedMessage,
  actLabel,
  actsFor,
  actsOpenTo,
  LADDER_ACTS,
  sweepConsequence,
  sweepDestinations,
  sweepLabel,
  sweepScope,
  sweepScopeMessage,
  sweptMessage,
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

describe('what a sweep of the Reading on screen would reach', () => {
  it('counts every stage the Reading is showing, and says how many of them can move', () => {
    const scope = sweepScope(['new', 'offer'], A_FULL_JOB);

    expect(scope).toEqual({ matching: 5, movable: 5, held: 0, stages: ['new', 'offer'] });
  });

  it('holds back the stages that have ended, because nothing moves them again', () => {
    const scope = sweepScope(['new', 'rejected'], A_FULL_JOB);

    expect(scope).toEqual({ matching: 13, movable: 4, held: 9, stages: ['new'] });
  });

  it('names no stage a sweep could act on where every stage shown has ended', () => {
    const scope = sweepScope(['rejected', 'withdrawn'], A_FULL_JOB);

    expect(scope).toEqual({ matching: 11, movable: 0, held: 11, stages: [] });
  });

  it('reads a stage the counts leave out as none of it, rather than as unknown', () => {
    expect(sweepScope(['interview'], { new: 4 }).matching).toBe(0);
  });

  it('says what the acts reach without waiting to be asked', () => {
    expect(sweepScopeMessage(sweepScope(['new'], A_FULL_JOB))).toContain(
      'not only the page on screen',
    );
  });

  it('says how many of a Reading reaching into the ended stages cannot move', () => {
    expect(sweepScopeMessage(sweepScope(['new', 'rejected'], A_FULL_JOB))).toBe(
      'of 13 matching can move. The other 9 have ended, and nothing moves them again.',
    );
  });

  it('counts what a Reading of nothing but ended stages holds, beside the nought that can move', () => {
    expect(sweepScopeMessage(sweepScope(['rejected'], A_FULL_JOB))).toBe(
      'of 9 matching, and none of them can move: every one has ended.',
    );
  });

  it('reads one held Application as one, rather than as a plural', () => {
    expect(sweepScopeMessage(sweepScope(['new', 'hired'], A_FULL_JOB))).toContain(
      'The other has ended',
    );
  });

  it('says nothing matches at all rather than that nothing can move', () => {
    expect(sweepScopeMessage(sweepScope(['new'], {}))).toBe('Nothing matches these filters.');
  });
});

describe('where a sweep can send a whole Reading', () => {
  it('offers the four rungs above New, and never a hire', () => {
    expect(sweepDestinations().map(([status]) => status)).toEqual([
      'reviewing',
      'shortlisted',
      'interview',
      'offer',
    ]);
  });

  it('names each one as the Pipeline names it', () => {
    expect(sweepDestinations()).toContainEqual(['shortlisted', 'Shortlisted']);
  });

  it('says what one confirm decides, and reads a single one as one', () => {
    expect(sweepLabel('rejected', 12)).toBe('End 12 Applications');
    expect(sweepLabel('rejected', 1)).toBe('End 1 Application');
    expect(sweepLabel('rejected', 0)).toBe('End Applications');
    expect(sweepLabel('shortlisted', 40)).toBe('Move 40 Applications to Shortlisted');
  });

  it('promises a ladder sweep reaches nobody, and an ending three days', () => {
    expect(sweepConsequence('shortlisted')).toContain('read as In review');
    expect(sweepConsequence('rejected')).toContain('three days');
  });

  it('reports an ending through the sentence a ticked ending reports through', () => {
    expect(sweptMessage({ moved: 4, told_at: THE_TELLING }, 'rejected')).toContain(
      '4 Applications ended',
    );
  });

  it('reports a ladder sweep by where it left them, claiming nothing about being told', () => {
    expect(sweptMessage({ moved: 4, told_at: null }, 'shortlisted')).toBe(
      '4 Applications are in Shortlisted.',
    );
    expect(sweptMessage({ moved: 1, told_at: null }, 'offer')).toBe('1 Application is in Offer.');
  });

  it('says the list had moved on rather than claiming a move it did not make', () => {
    expect(sweptMessage({ moved: 0, told_at: null }, 'interview')).toBe(
      'Nothing moved — the list had already moved on.',
    );
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

describe('reading back what one act moved', () => {
  it('carries the count and the Telling the whole set was given', () => {
    expect(whatItSwept({ moved: 4, told_at: THE_TELLING })).toEqual({
      moved: 4,
      toldAt: THE_TELLING,
    });
  });

  it('reads a move that told nobody as no Telling at all', () => {
    expect(whatItSwept({ moved: 0 })).toEqual({ moved: 0, toldAt: null });
    expect(whatItSwept({ moved: 3, told_at: null })).toEqual({ moved: 3, toldAt: null });
  });
});
