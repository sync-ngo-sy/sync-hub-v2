import { describe, expect, it } from 'vitest';
import { SCREENING_VERDICTS } from './application';
import {
  applicationsAddress,
  applicationsReading,
  clearFiltersLabel,
  jobApplicationsAddress,
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
    expect(narrowedBy(read({ pipeline: 'hired' }))).toBe(1);
  });

  it('counts neither of the two tabs nobody has to choose to be looking at', () => {
    expect(narrowedBy(read({ pipeline: 'open' }))).toBe(0);
    expect(narrowedBy(read({ pipeline: 'all' }))).toBe(0);
  });

  it('counts a Verdict filter that leaves a verdict out, and not one that checks all four', () => {
    expect(narrowedBy(read({ screening: ['qualified'] }))).toBe(1);
    expect(narrowedBy(read({ screening: [...SCREENING_VERDICTS] }))).toBe(0);
  });

  it('counts a Received window shorter than all time', () => {
    expect(narrowedBy(read({ received: '7d' }))).toBe(1);
  });

  it('counts a Pipeline tab and a Verdict filter as two, from the Reading alone', () => {
    expect(narrowedBy(read({ pipeline: 'interview', screening: ['pending'] }))).toBe(2);
  });

  it('counts all three when a window joins them', () => {
    expect(narrowedBy(read({ pipeline: 'new', screening: ['pending'], received: '24h' }))).toBe(3);
  });

  it('counts nothing for an address naming a tab this list has never had', () => {
    expect(narrowedBy(read({ pipeline: ['new', 'hired'] }))).toBe(0);
    expect(narrowedBy(read({ pipeline: 'on-a-yacht' }))).toBe(0);
  });

  it('reads an address that names a choice twice as the one choice it is', () => {
    expect(narrowedBy(read({ screening: ['qualified', 'qualified', 'pending', 'pending'] }))).toBe(
      1,
    );
  });
});

describe('what a list writes into the address', () => {
  it('leaves Open out, because it is where an untouched list starts', () => {
    expect(applicationsAddress(read({})).pipeline).toBeUndefined();
    expect(applicationsAddress(read({ pipeline: 'open' })).pipeline).toBeUndefined();
    expect(jobApplicationsAddress(read({ pipeline: 'open' })).pipeline).toBeUndefined();
  });

  it('writes every other tab in, so a reload and a pasted link reproduce the list', () => {
    expect(applicationsAddress(read({ pipeline: 'all' })).pipeline).toBe('all');
    expect(applicationsAddress(read({ pipeline: 'rejected' })).pipeline).toBe('rejected');
    expect(jobApplicationsAddress(read({ pipeline: 'hired' })).pipeline).toBe('hired');
  });
});

describe('what an empty list says', () => {
  it('tells a Tenant nobody has applied to, and a Job nobody has applied to, apart', () => {
    expect(noApplicationsMessage(read({}))).toMatch(/^No Applications yet/);
    expect(noJobApplicationsMessage(read({}))).toMatch(/^No one has applied yet/);
  });

  it('blames one filter or several, in the words each list uses', () => {
    const one = read({ pipeline: 'hired' });
    const two = read({ pipeline: 'hired', screening: ['pending'] });

    expect(noApplicationsMessage(one)).toBe('No Application matches that filter.');
    expect(noApplicationsMessage(two)).toBe('No Application matches these filters.');
    expect(noJobApplicationsMessage(one)).toBe('No Application on this Job matches that filter.');
    expect(noJobApplicationsMessage(two)).toBe('No Application on this Job matches both filters.');
  });

  it('offers to clear what it blamed, and says how many that is', () => {
    expect(clearFiltersLabel(read({ pipeline: 'hired' }))).toBe('Clear filter');
    expect(clearFiltersLabel(read({ pipeline: 'hired', received: '7d' }))).toBe('Clear filters');
  });
});
