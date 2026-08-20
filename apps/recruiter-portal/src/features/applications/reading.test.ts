import { describe, expect, it } from 'vitest';
import { SCREENING_VERDICTS } from './application';
import {
  applicationsReading,
  clearFiltersLabel,
  narrowedBy,
  noApplicationsMessage,
  noJobApplicationsMessage,
  type TenantApplicationFilters,
} from './reading';

function read(address: unknown): TenantApplicationFilters {
  return applicationsReading.parse(address);
}

describe('how many filters narrow a list', () => {
  it('counts nothing on a list nobody has touched', () => {
    expect(narrowedBy(read({}))).toBe(0);
    expect(narrowedBy(read({ sort: 'oldest' }))).toBe(0);
  });

  it('counts a chosen Pipeline tab', () => {
    expect(narrowedBy(read({ pipeline: ['hired'] }))).toBe(1);
  });

  it('counts a Verdict filter that leaves a verdict out, and not one that checks all four', () => {
    expect(narrowedBy(read({ screening: ['qualified'] }))).toBe(1);
    expect(narrowedBy(read({ screening: [...SCREENING_VERDICTS] }))).toBe(0);
  });

  it('counts a Received window shorter than all time', () => {
    expect(narrowedBy(read({ received: '7d' }))).toBe(1);
  });

  it('counts a Pipeline tab and a Verdict filter as two, from the Reading alone', () => {
    expect(narrowedBy(read({ pipeline: ['interview'], screening: ['pending'] }))).toBe(2);
  });

  it('counts all three when a window joins them', () => {
    expect(narrowedBy(read({ pipeline: ['new'], screening: ['pending'], received: '24h' }))).toBe(
      3,
    );
  });

  it('counts nothing for an address naming more than one Pipeline status, which is no tab', () => {
    expect(narrowedBy(read({ pipeline: ['new', 'hired'] }))).toBe(0);
  });

  it('reads an address that names a choice twice as the one choice it is', () => {
    expect(narrowedBy(read({ screening: ['qualified', 'qualified', 'pending', 'pending'] }))).toBe(
      1,
    );
    expect(narrowedBy(read({ pipeline: ['new', 'new'] }))).toBe(1);
  });
});

describe('what an empty list says', () => {
  it('tells a Tenant nobody has applied to, and a Job nobody has applied to, apart', () => {
    expect(noApplicationsMessage(read({}))).toMatch(/^No Applications yet/);
    expect(noJobApplicationsMessage(read({}))).toMatch(/^No one has applied yet/);
  });

  it('blames one filter or several, in the words each list uses', () => {
    const one = read({ pipeline: ['hired'] });
    const two = read({ pipeline: ['hired'], screening: ['pending'] });

    expect(noApplicationsMessage(one)).toBe('No Application matches that filter.');
    expect(noApplicationsMessage(two)).toBe('No Application matches these filters.');
    expect(noJobApplicationsMessage(one)).toBe('No Application on this Job matches that filter.');
    expect(noJobApplicationsMessage(two)).toBe('No Application on this Job matches both filters.');
  });

  it('offers to clear what it blamed, and says how many that is', () => {
    expect(clearFiltersLabel(read({ pipeline: ['hired'] }))).toBe('Clear filter');
    expect(clearFiltersLabel(read({ pipeline: ['hired'], received: '7d' }))).toBe('Clear filters');
  });
});
