import { describe, expect, it } from 'vitest';
import { claimCountsFrom, claimState, claimTab, tabInAddress } from './placement';
import { LAYLA_DENIED, NOUR_PLACED, SAMER_WAITING } from './testing/fixtures';

describe('which tab a Reading names', () => {
  it('opens on the confirmed Placements when the address says nothing', () => {
    expect(claimTab(undefined)).toBe('confirmed');
  });

  it('reads the tab the address does name', () => {
    expect(claimTab('unanswered')).toBe('unanswered');
    expect(claimTab('denied')).toBe('denied');
  });

  it('leaves the tab it opens on out of the address, and writes the other two', () => {
    expect(tabInAddress('confirmed')).toBeUndefined();
    expect(tabInAddress('unanswered')).toBe('unanswered');
    expect(tabInAddress('denied')).toBe('denied');
  });
});

describe('where a claim stands', () => {
  it('reads an unanswered claim its age rather than deciding anything by it', () => {
    expect(claimState(SAMER_WAITING)).toEqual({
      label: 'Waiting since March 4, 2026',
      tone: 'waiting',
    });
  });

  it('names the answer on a claim that has one', () => {
    expect(claimState(NOUR_PLACED)).toEqual({ label: 'Confirmed', tone: 'active' });
    expect(claimState(LAYLA_DENIED)).toEqual({ label: 'Denied', tone: 'ended' });
  });
});

describe('the counts the tabs carry', () => {
  it('reads each standing its own count', () => {
    expect(
      claimCountsFrom([
        { confirmation: 'confirmed', count: 9 },
        { confirmation: 'unanswered', count: 2 },
        { confirmation: 'denied', count: 1 },
      ]),
    ).toEqual({ confirmed: 9, unanswered: 2, denied: 1 });
  });

  it('counts nothing before the first page has answered', () => {
    expect(claimCountsFrom(undefined)).toEqual({});
  });
});
