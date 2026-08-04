import { describe, expect, it } from 'vitest';
import {
  answerText,
  historyLine,
  linkLabel,
  period,
  pipelineMoves,
  pipelineOutcome,
  yearsOfExperience,
} from './review';

const targets = (status: Parameters<typeof pipelineMoves>[0]) =>
  pipelineMoves(status).map((move) => move.target);

describe('the Pipeline moves offered from a status', () => {
  /** Written out from the API's own MOVES table in `applications/pipeline.py`, every row of it,
   * so the two can be compared by eye and a drift on either side shows up here. */
  it('offers every other undecided stage and both decisions while it is undecided', () => {
    expect(targets('new')).toEqual([
      'reviewing',
      'shortlisted',
      'interview',
      'offer',
      'hired',
      'rejected',
    ]);
    expect(targets('reviewing')).toEqual([
      'shortlisted',
      'interview',
      'offer',
      'hired',
      'rejected',
      'new',
    ]);
    expect(targets('shortlisted')).toEqual([
      'interview',
      'offer',
      'hired',
      'rejected',
      'reviewing',
      'new',
    ]);
    expect(targets('interview')).toEqual([
      'offer',
      'hired',
      'rejected',
      'shortlisted',
      'reviewing',
      'new',
    ]);
    expect(targets('offer')).toEqual([
      'hired',
      'rejected',
      'interview',
      'shortlisted',
      'reviewing',
      'new',
    ]);
  });

  it('offers nothing once it is hired or withdrawn', () => {
    expect(targets('hired')).toEqual([]);
    expect(targets('withdrawn')).toEqual([]);
  });

  it('offers a rejected Application the one way back the platform allows', () => {
    expect(targets('rejected')).toEqual(['reviewing']);
    expect(pipelineMoves('rejected').map((move) => move.label)).toEqual(['Reopen for review']);
  });

  it('never offers a move to where the Application already is', () => {
    for (const status of ['new', 'reviewing', 'shortlisted', 'interview', 'offer'] as const) {
      expect(targets(status)).not.toContain(status);
    }
  });

  it('never offers withdrawing, because only the candidate leaves', () => {
    for (const status of ['new', 'reviewing', 'shortlisted', 'interview', 'offer'] as const) {
      expect(targets(status)).not.toContain('withdrawn');
    }
  });

  it('names a forward move by its stage and a decision by the decision', () => {
    const labels = pipelineMoves('reviewing').map((move) => move.label);
    expect(labels).toEqual([
      'Move to Shortlisted',
      'Move to Interview',
      'Move to Offer',
      'Mark as hired',
      'Reject',
      'Move back to New',
    ]);
  });

  it('says a rejection is emailed and every other move is only told in-app', () => {
    const success = (status: 'reviewing', target: string) =>
      pipelineMoves(status).find((move) => move.target === target)?.success;

    expect(success('reviewing', 'rejected')).toBe('Rejected — the candidate has been emailed.');
    expect(success('reviewing', 'shortlisted')).toBe('Shortlisted — the candidate has been told.');
  });
});

describe('how a terminal status reads', () => {
  it('says a hired Application is closed', () => {
    expect(pipelineOutcome('hired')).toBe('Hired. This Application is closed — nothing moves it.');
  });

  it("says a withdrawal was the candidate's own move", () => {
    expect(pipelineOutcome('withdrawn')).toBe(
      'The candidate withdrew. That was theirs to do, and nothing moves it now.',
    );
  });

  it('says nothing at all while the Application is still being decided', () => {
    for (const status of ['new', 'reviewing', 'shortlisted', 'interview', 'offer'] as const) {
      expect(pipelineOutcome(status)).toBeNull();
    }
  });

  it('says nothing for a rejected Application, which still has a way back', () => {
    expect(pipelineOutcome('rejected')).toBeNull();
  });
});

describe('how a Snapshot entry dates itself', () => {
  it('reads a month and year at both ends', () => {
    expect(
      period({ start_year: 2018, start_month: 1, end_year: 2022, end_month: 2, is_current: false }),
    ).toBe('Jan 2018 – Feb 2022');
  });

  it('says Present for a job the candidate still holds', () => {
    expect(
      period({
        start_year: 2022,
        start_month: 3,
        end_year: null,
        end_month: null,
        is_current: true,
      }),
    ).toBe('Mar 2022 – Present');
  });

  it('drops the month the candidate never gave', () => {
    expect(period({ start_year: 2019, start_month: null, end_year: 2021, end_month: null })).toBe(
      '2019 – 2021',
    );
  });

  it('reads an open end as the start alone rather than inventing one', () => {
    expect(
      period({
        start_year: 2020,
        start_month: 5,
        end_year: null,
        end_month: null,
        is_current: false,
      }),
    ).toBe('May 2020');
  });

  it('has nothing to say when the candidate gave no years at all', () => {
    expect(
      period({ start_year: null, start_month: null, end_year: null, end_month: null }),
    ).toBeNull();
  });

  it('ignores a month it cannot name', () => {
    expect(period({ start_year: 2020, start_month: 13, end_year: null, end_month: null })).toBe(
      '2020',
    );
  });
});

describe('how long a candidate says they have done a skill', () => {
  it('counts whole and part years', () => {
    expect(yearsOfExperience(1)).toBe('1 year');
    expect(yearsOfExperience(3)).toBe('3 years');
    expect(yearsOfExperience(2.5)).toBe('2.5 years');
  });

  it('does not round a few months up to a year', () => {
    expect(yearsOfExperience(0.5)).toBe('Under a year');
    expect(yearsOfExperience(0)).toBe('Under a year');
  });
});

describe('how a link a candidate gave reads on screen', () => {
  it('drops the scheme, which no reader needs', () => {
    expect(linkLabel('https://example.test/cold-chain-repo')).toBe('example.test/cold-chain-repo');
    expect(linkLabel('http://example.test/x')).toBe('example.test/x');
  });

  it('drops a trailing slash, so two spellings of one address read alike', () => {
    expect(linkLabel('https://example.test/')).toBe('example.test');
  });

  it('leaves an address it does not recognise exactly as the candidate typed it', () => {
    expect(linkLabel('example.test/x')).toBe('example.test/x');
  });
});

describe('how one move in the Application’s life reads', () => {
  it('reads the first entry as the submission it is', () => {
    expect(
      historyLine({
        status: 'new',
        previous_status: null,
        source: 'candidate',
        changed_at: '2026-08-02T09:00:00Z',
      }),
    ).toEqual({ title: 'Applied', detail: 'by the candidate' });
  });

  it('names where a move went, where it came from, and who made it', () => {
    expect(
      historyLine({
        status: 'shortlisted',
        previous_status: 'reviewing',
        source: 'recruiter',
        changed_at: '2026-08-02T14:30:00Z',
      }),
    ).toEqual({ title: 'Moved to Shortlisted', detail: 'from Reviewing · by a recruiter' });
  });

  it('credits the platform for a move nobody pressed', () => {
    expect(
      historyLine({
        status: 'rejected',
        previous_status: 'new',
        source: 'system',
        changed_at: '2026-08-02T14:30:00Z',
      }).detail,
    ).toBe('from New · by the platform');
  });
});

describe('what a Candidate answered', () => {
  const YES_NO = { question_id: 'q1', question_text: 'Licence?', question_type: 'yes_no' } as const;
  const TEXT = { question_id: 'q2', question_text: 'Where?', question_type: 'short_text' } as const;

  it('reads a yes-or-no answer as a word', () => {
    expect(answerText({ ...YES_NO, answer_boolean: true, answer_text: null })).toBe('Yes');
    expect(answerText({ ...YES_NO, answer_boolean: false, answer_text: null })).toBe('No');
  });

  it('reads a written answer as written', () => {
    expect(answerText({ ...TEXT, answer_boolean: null, answer_text: 'Aleppo and Idlib.' })).toBe(
      'Aleppo and Idlib.',
    );
  });

  it('says an answer is missing rather than showing a blank', () => {
    expect(answerText({ ...YES_NO, answer_boolean: null, answer_text: null })).toBe('Not answered');
    expect(answerText({ ...TEXT, answer_boolean: null, answer_text: '   ' })).toBe('Not answered');
  });
});
