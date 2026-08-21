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
    expect(pipelineTab(ALL_TAB)).toBe(ALL_TAB);
    expect(pipelineTab('hired')).toBe('hired');
  });

  it('holds new through offer on Open, and nothing that has ended', () => {
    expect(pipelineStatuses(OPEN_TAB)).toEqual([
      'new',
      'reviewing',
      'shortlisted',
      'interview',
      'offer',
    ]);
  });

  it('asks for every status on All, which is what naming none means to the API', () => {
    expect(pipelineStatuses(ALL_TAB)).toBeUndefined();
  });

  it('asks for the one status every other tab is', () => {
    expect(pipelineStatuses('rejected')).toEqual(['rejected']);
    expect(pipelineStatuses('new')).toEqual(['new']);
  });

  it('leaves Open out of the address and writes every other tab into it', () => {
    expect(pipelineInAddress(OPEN_TAB)).toBeUndefined();
    expect(pipelineInAddress(undefined)).toBeUndefined();
    expect(pipelineInAddress(ALL_TAB)).toBe(ALL_TAB);
    expect(pipelineInAddress('withdrawn')).toBe('withdrawn');
  });

  it('splits the eight statuses between the ones still open and the ones that ended', () => {
    expect([...OPEN_STATUSES, ...ENDED_STATUSES].sort()).toEqual([...PIPELINE_STATUSES].sort());
  });

  it('holds one status on every tab but the two that are not statuses', () => {
    expect(holdsOneStatus(OPEN_TAB)).toBe(false);
    expect(holdsOneStatus(ALL_TAB)).toBe(false);
    expect(holdsOneStatus('offer')).toBe(true);
  });

  it('names the two tabs that are not statuses, and reads the rest off the status', () => {
    expect(pipelineTabLabel(OPEN_TAB)).toBe('Open');
    expect(pipelineTabLabel(ALL_TAB)).toBe('All');
    expect(pipelineTabLabel('reviewing')).toBe('Reviewing');
    expect(pipelineTabLabel('withdrawn')).toBe('Withdrawn');
  });
});

describe("what a Pipeline tab's count adds up", () => {
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

  it('counts new through offer on Open', () => {
    expect(pipelineTabCount(OPEN_TAB, COUNTS)).toBe(7);
  });

  it('counts all eight on All, terminal Applications included', () => {
    expect(pipelineTabCount(ALL_TAB, COUNTS)).toBe(106);
  });

  it('counts the one status every other tab is', () => {
    expect(pipelineTabCount('rejected', COUNTS)).toBe(90);
  });

  it('reads a status the API left uncounted as none', () => {
    expect(pipelineTabCount('hired', {})).toBe(0);
    expect(pipelineTabCount(OPEN_TAB, { new: 2 })).toBe(2);
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
