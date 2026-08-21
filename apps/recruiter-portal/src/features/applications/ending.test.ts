import { describe, expect, it } from 'vitest';
import {
  endableStatuses,
  endedMessage,
  endingTotalMessage,
  endLabel,
  endsWhatItTicked,
  nothingIsOpen,
  stillOpen,
  sweptTogether,
  tickedLabel,
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
    expect(endLabel(12)).toBe('End 12 Applications');
    expect(endLabel(1)).toBe('End 1 Application');
    expect(endLabel(0)).toBe('End Applications');
  });
});

describe('a Job with nothing left to end', () => {
  it('is one whose five undecided statuses are all empty', () => {
    expect(nothingIsOpen({ hired: 1, rejected: 9, withdrawn: 2 })).toBe(true);
    expect(nothingIsOpen({})).toBe(true);
    expect(nothingIsOpen({ offer: 1, rejected: 9 })).toBe(false);
  });
});

describe('which rows a tick means anything on', () => {
  it('offers one on an Application still being decided, and none on one that has ended', () => {
    expect(stillOpen('new')).toBe(true);
    expect(stillOpen('offer')).toBe(true);
    expect(stillOpen('hired')).toBe(false);
    expect(stillOpen('rejected')).toBe(false);
    expect(stillOpen('withdrawn')).toBe(false);
  });

  it('says how many rows are ticked, and reads a single one as one', () => {
    expect(tickedLabel(3)).toBe('3 Applications ticked');
    expect(tickedLabel(1)).toBe('1 Application ticked');
  });
});

describe('what an ending reports back', () => {
  it('says how many ended and the day they hear', () => {
    expect(endedMessage({ ended: 12, told_at: THE_TELLING })).toBe(
      '12 Applications ended — they hear on August 24, 2026.',
    );
    expect(endedMessage({ ended: 1, told_at: THE_TELLING })).toBe(
      '1 Application ended — they hear on August 24, 2026.',
    );
  });

  it('will not claim an ending where the list had already moved on', () => {
    expect(endedMessage({ ended: 0, told_at: null })).toBe(
      'Nothing was ended — every Application the ticks named had already moved.',
    );
  });

  it('says which of the ticked rows the ending missed, and says nothing when it missed none', () => {
    expect(endedMessage({ ended: 2, told_at: THE_TELLING }, 3)).toBe(
      '2 of 3 Applications ended — the other had already moved.',
    );
    expect(endedMessage({ ended: 1, told_at: THE_TELLING }, 3)).toBe(
      '1 of 3 Applications ended — the others had already moved.',
    );
    expect(endedMessage({ ended: 3, told_at: THE_TELLING }, 3)).toBe(
      '3 Applications ended — they hear on August 24, 2026.',
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

describe('rows ended one move at a time', () => {
  const moved = (told_at: string | null) => ({
    id: 'a1',
    status: 'rejected' as const,
    previous_status: 'new' as const,
    candidate_notified: false,
    told_at,
    changed_at: '2026-08-21T10:00:00Z',
  });

  it('reads back as one answer, carrying the Telling they all share', () => {
    expect(sweptTogether([moved(THE_TELLING), moved(THE_TELLING)])).toEqual({
      ended: 2,
      told_at: THE_TELLING,
    });
  });

  it('counts only the rows that really moved', () => {
    expect(sweptTogether([moved(THE_TELLING), null, null])).toEqual({
      ended: 1,
      told_at: THE_TELLING,
    });
    expect(sweptTogether([null])).toEqual({ ended: 0, told_at: null });
  });
});
