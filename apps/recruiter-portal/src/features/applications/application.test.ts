import { describe, expect, it } from 'vitest';
import {
  ALL_TAB,
  anythingEnded,
  ENDED_STATUSES,
  holdsOneStatus,
  OPEN_STATUSES,
  OPEN_TAB,
  PIPELINE_STATUSES,
  PIPELINE_TABS,
  pipelineInAddress,
  pipelineStatuses,
  pipelineTab,
  pipelineTabCount,
  pipelineTabLabel,
  stagesCount,
  sweepableStages,
  tabStages,
} from './application';

describe('the Pipeline tabs', () => {
  it('runs Open first, then the eight statuses in Pipeline order, then All', () => {
    expect([...PIPELINE_TABS]).toEqual([
      'open',
      'new',
      'reviewing',
      'shortlisted',
      'interview',
      'offer',
      'hired',
      'rejected',
      'withdrawn',
      'all',
    ]);
  });

  it('opens a list nobody has touched on Open', () => {
    expect(pipelineTab(undefined)).toBe(OPEN_TAB);
    expect(pipelineTab('withdrawn')).toBe('withdrawn');
  });

  it('stands each tab for the stages it names', () => {
    expect(tabStages(OPEN_TAB)).toEqual([...OPEN_STATUSES]);
    expect(tabStages(ALL_TAB)).toEqual([...PIPELINE_STATUSES]);
    expect(tabStages('withdrawn')).toEqual(['withdrawn']);
  });

  it('asks the API for the stages a tab names, and for none of them on All', () => {
    expect(pipelineStatuses('rejected')).toEqual(['rejected']);
    expect(pipelineStatuses(OPEN_TAB)).toEqual([...OPEN_STATUSES]);
    expect(pipelineStatuses(ALL_TAB)).toBeUndefined();
  });

  it('leaves the tab an untouched list opens on out of the address', () => {
    expect(pipelineInAddress(undefined)).toBeUndefined();
    expect(pipelineInAddress(OPEN_TAB)).toBeUndefined();
    expect(pipelineInAddress('withdrawn')).toBe('withdrawn');
  });

  it('names the two tabs that were never stages after themselves', () => {
    expect(pipelineTabLabel(OPEN_TAB)).toBe('Open');
    expect(pipelineTabLabel(ALL_TAB)).toBe('All');
    expect(pipelineTabLabel('shortlisted')).toBe('Shortlisted');
  });

  it('splits the eight statuses between the ones still open and the ones that ended', () => {
    expect([...OPEN_STATUSES, ...ENDED_STATUSES].sort()).toEqual([...PIPELINE_STATUSES].sort());
  });

  it('knows a tab that is one stage from the two that are many', () => {
    expect(holdsOneStatus('offer')).toBe(true);
    expect(holdsOneStatus(OPEN_TAB)).toBe(false);
    expect(holdsOneStatus(ALL_TAB)).toBe(false);
  });
});

describe('what a selection of stages adds up', () => {
  const COUNTS = {
    new: 2,
    reviewing: 1,
    shortlisted: 0,
    interview: 3,
    offer: 1,
    hired: 4,
    rejected: 90,
    withdrawn: 5,
  };

  it('counts a tab as the stages it stands for', () => {
    expect(pipelineTabCount(OPEN_TAB, COUNTS)).toBe(7);
    expect(pipelineTabCount(ALL_TAB, COUNTS)).toBe(106);
    expect(pipelineTabCount('rejected', COUNTS)).toBe(90);
  });

  it('counts the stages named, and nothing else', () => {
    expect(stagesCount(OPEN_STATUSES, COUNTS)).toBe(7);
    expect(stagesCount(PIPELINE_STATUSES, COUNTS)).toBe(106);
    expect(stagesCount(['rejected'], COUNTS)).toBe(90);
  });

  it('reads a stage the API left uncounted as none', () => {
    expect(stagesCount(['hired'], {})).toBe(0);
    expect(stagesCount(OPEN_STATUSES, { new: 2 })).toBe(2);
  });
});

describe('the stages of a selection a sweep can act on', () => {
  it('keeps the ones still being decided and drops the ones that have ended', () => {
    expect(sweepableStages([...PIPELINE_STATUSES])).toEqual([...OPEN_STATUSES]);
    expect(sweepableStages(['new', 'rejected'])).toEqual(['new']);
  });

  it('reaches nothing at all where every stage named has ended', () => {
    expect(sweepableStages(['rejected', 'hired', 'withdrawn'])).toEqual([]);
  });
});

describe('whether anything a list leaves out has ended', () => {
  it('reads the three statuses an Application ends on, and nothing else', () => {
    expect(anythingEnded({ hired: 1 })).toBe(true);
    expect(anythingEnded({ rejected: 90 })).toBe(true);
    expect(anythingEnded({ withdrawn: 2 })).toBe(true);
    expect(anythingEnded({ new: 3, reviewing: 1, offer: 2 })).toBe(false);
  });

  it('reads a count of none, and a count the API never sent, as nothing ended', () => {
    expect(anythingEnded({ hired: 0, rejected: 0, withdrawn: 0 })).toBe(false);
    expect(anythingEnded({})).toBe(false);
  });
});
