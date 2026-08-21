import { describe, expect, it } from 'vitest';
import type { PipelineStatus } from './application';
import {
  answerText,
  hireState,
  historyLine,
  type MovedApplication,
  moveOutcome,
  pipelineMoves,
  pipelineOutcome,
  telling,
} from './review';

const targets = (status: Parameters<typeof pipelineMoves>[0]) =>
  pipelineMoves(status).map((move) => move.target);

describe('the Pipeline moves offered from a status', () => {
  it('offers every other undecided status and both decisions while it is undecided', () => {
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

  it('names a forward move by its status and a decision by the decision', () => {
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

  it('states what a move did, and leaves who heard about it to the answer', () => {
    const happened = (target: string) =>
      pipelineMoves('reviewing').find((move) => move.target === target)?.happened;

    expect(happened('rejected')).toBe('Rejected');
    expect(happened('shortlisted')).toBe('Shortlisted');
  });
});

describe('what a move reports back', () => {
  const moveTo = (target: string, from: PipelineStatus = 'reviewing') => {
    const move = pipelineMoves(from).find((one) => one.target === target);
    if (!move) throw new Error(`no move to ${target}`);
    return move;
  };
  const NOW = new Date('2026-08-21T10:00:00Z');
  const AHEAD = '2026-08-24T10:00:00Z';
  const BEHIND = '2026-08-18T10:00:00Z';
  const moved = (changes: Partial<MovedApplication>): MovedApplication => ({
    id: '00000000-0000-4000-8000-000000000001',
    status: 'reviewing',
    previous_status: 'reviewing',
    candidate_notified: false,
    told_at: null,
    changed_at: '2026-08-21T10:00:00Z',
    ...changes,
  });

  it('names the day a rejection reaches the candidate, rather than claiming it has', () => {
    expect(
      moveOutcome(
        moveTo('rejected'),
        moved({ status: 'rejected', previous_status: 'reviewing', told_at: AHEAD }),
        NOW,
      ),
    ).toBe('Rejected — the candidate hears on August 24, 2026.');
  });

  it('says a reopen inside the three days cancelled the email nobody saw', () => {
    expect(
      moveOutcome(
        moveTo('reviewing', 'rejected'),
        moved({ previous_status: 'rejected', told_at: AHEAD }),
        NOW,
      ),
    ).toBe('Reopened for review — the candidate was never told, and the email is cancelled.');
  });

  it('names the day the candidate was told when the reopen comes after it', () => {
    expect(
      moveOutcome(
        moveTo('reviewing', 'rejected'),
        moved({ previous_status: 'rejected', told_at: BEHIND }),
        NOW,
      ),
    ).toBe(
      'Reopened for review — the candidate was told on August 18, 2026, and no email is sent.',
    );
  });

  it('says the candidate was told when the move changed their Stage', () => {
    expect(
      moveOutcome(moveTo('hired'), moved({ status: 'hired', candidate_notified: true }), NOW),
    ).toBe('Marked as hired — the candidate has been told.');
  });

  it('says the candidate sees nothing when the move stayed inside one Stage', () => {
    expect(moveOutcome(moveTo('shortlisted'), moved({ status: 'shortlisted' }), NOW)).toBe(
      'Shortlisted — the candidate sees no change.',
    );
  });
});

describe('what the review says about the Telling', () => {
  const NOW = new Date('2026-08-21T10:00:00Z');

  it('says nothing at all about an Application that was never rejected', () => {
    expect(telling('shortlisted', null, NOW)).toBeNull();
    expect(telling('reviewing', '2026-08-18T10:00:00Z', NOW)).toBeNull();
  });

  it('names the day a waiting candidate hears, and what reopening does before then', () => {
    expect(telling('rejected', '2026-08-24T10:00:00Z', NOW)).toEqual({
      told: false,
      text:
        'The candidate has not been told. They hear on August 24, 2026 — until then, ' +
        'reopening this cancels the email and leaves them in review.',
    });
  });

  it('warns after the Telling, names the day, and says no email is sent', () => {
    expect(telling('rejected', '2026-08-18T10:00:00Z', NOW)).toEqual({
      told: true,
      text:
        'The candidate was told on August 18, 2026. Reopening sends no email — message them ' +
        'by hand if they should know.',
    });
  });
});

describe('how a claimed hire reads', () => {
  const claim = { start_date: '2026-09-01', claimed_at: '2026-08-01T09:00:00Z' };

  it('says an unanswered claim is only a claim', () => {
    expect(hireState({ ...claim, confirmation: 'unanswered', answered_at: null })).toBe(
      'Waiting for the candidate to confirm. Until they do, this is a claim.',
    );
  });

  it('says a confirmed claim is a placement', () => {
    expect(
      hireState({ ...claim, confirmation: 'confirmed', answered_at: '2026-08-02T09:00:00Z' }),
    ).toBe('The candidate confirmed this. It is a placement.');
  });

  it('says a denied claim is not one', () => {
    expect(
      hireState({ ...claim, confirmation: 'denied', answered_at: '2026-08-02T09:00:00Z' }),
    ).toBe('The candidate says they did not start. This is not a placement.');
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
