import { describe, expect, it } from 'vitest';
import {
  answerText,
  hireState,
  historyLine,
  moveOutcome,
  pipelineMoves,
  pipelineOutcome,
} from './review';

const targets = (status: Parameters<typeof pipelineMoves>[0]) =>
  pipelineMoves(status).map((move) => move.target);

describe('the Pipeline moves offered from a status', () => {
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

  it('states what a move did, and leaves who heard about it to the answer', () => {
    const success = (target: string) =>
      pipelineMoves('reviewing').find((move) => move.target === target)?.success;

    expect(success('rejected')).toBe('Rejected');
    expect(success('shortlisted')).toBe('Shortlisted');
  });
});

describe('what a move reports back', () => {
  const moveTo = (target: string) => {
    const move = pipelineMoves('reviewing').find((one) => one.target === target);
    if (!move) throw new Error(`no move to ${target}`);
    return move;
  };

  it('says a rejection is emailed, which no other move is', () => {
    expect(moveOutcome(moveTo('rejected'), true)).toBe(
      'Rejected — the candidate has been emailed.',
    );
  });

  it('says the candidate was told when the move changed their Stage', () => {
    expect(moveOutcome(moveTo('hired'), true)).toBe(
      'Marked as hired — the candidate has been told.',
    );
  });

  it('says the candidate sees nothing when the move stayed inside one Stage', () => {
    expect(moveOutcome(moveTo('shortlisted'), false)).toBe(
      'Shortlisted — the candidate sees no change.',
    );
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
