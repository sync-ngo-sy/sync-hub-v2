import { describe, expect, it } from 'vitest';
import { PIPELINE_STATUSES } from './application';
import {
  answerText,
  historyLine,
  pipelineMoveGroups,
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

  it('says a rejection is emailed and every other move is only told in-app', () => {
    const success = (status: 'reviewing', target: string) =>
      pipelineMoves(status).find((move) => move.target === target)?.success;

    expect(success('reviewing', 'rejected')).toBe('Rejected — the candidate has been emailed.');
    expect(success('reviewing', 'shortlisted')).toBe('Shortlisted — the candidate has been told.');
  });
});

describe('how the offered moves are grouped for reading', () => {
  const labels = (status: Parameters<typeof pipelineMoveGroups>[0]) =>
    pipelineMoveGroups(status).map((group) => group.moves.map((move) => move.label));

  it('reads onward first, then back, then the rejection on its own', () => {
    expect(labels('shortlisted')).toEqual([
      ['Move to Interview', 'Move to Offer', 'Mark as hired'],
      ['Move back to Reviewing', 'Move back to New'],
      ['Reject'],
    ]);
  });

  it('never leaves the rejection amongst the moves a Recruiter makes freely', () => {
    for (const status of ['new', 'reviewing', 'shortlisted', 'interview', 'offer'] as const) {
      const groups = pipelineMoveGroups(status);
      expect(groups.at(-1)?.moves.map((move) => move.label)).toEqual(['Reject']);
    }
  });

  it('offers no empty group, so nothing is separated off from nothing', () => {
    for (const status of PIPELINE_STATUSES) {
      expect(pipelineMoveGroups(status).every((group) => group.moves.length > 0)).toBe(true);
    }
  });

  it('groups a rejected Application’s one way back as a move back', () => {
    expect(labels('rejected')).toEqual([['Reopen for review']]);
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
