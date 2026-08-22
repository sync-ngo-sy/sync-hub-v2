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
  readingNamed,
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

  it('counts nothing for an address naming a stage no Application can stand in', () => {
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
    expect(applicationsAddress(read({ pipeline: 'rejected' })).pipeline).toBe('rejected');
    expect(jobApplicationsAddress(read({ pipeline: 'hired' })).pipeline).toBe('hired');
  });

  it('spells All out rather than leaving it out, because All is not what an untouched list shows', () => {
    expect(applicationsAddress(read({ pipeline: 'all' })).pipeline).toBe('all');
  });
});

describe('the Reading in words, beside the acts that reach all of it', () => {
  it('names the tab, and says every verdict where the verdicts are untouched', () => {
    expect(readingNamed('open', [...SCREENING_VERDICTS])).toBe('Open · every verdict');
    expect(readingNamed('shortlisted', [...SCREENING_VERDICTS])).toBe(
      'Shortlisted · every verdict',
    );
  });

  it('names the verdicts a narrowed Screening filter leaves, so the acts cannot reach further', () => {
    expect(readingNamed('all', ['qualified', 'pending'])).toBe('All · Qualified, Pending');
  });

  it('adds the window only where one narrows the list', () => {
    expect(readingNamed('open', [...SCREENING_VERDICTS], '7d')).toBe(
      'Open · every verdict · Last 7 days',
    );
    expect(readingNamed('open', [...SCREENING_VERDICTS], undefined)).toBe('Open · every verdict');
  });
});

describe('what an empty list says', () => {
  it('tells a Tenant nobody has applied to, and a Job nobody has applied to, apart', () => {
    expect(noApplicationsMessage(read({}), false)).toMatch(/^No Applications yet/);
    expect(noJobApplicationsMessage(read({}), false)).toMatch(/^No one has applied yet/);
  });

  it('will not tell a Tenant whose every Application ended that nobody has applied', () => {
    expect(noApplicationsMessage(read({}), true)).toBe(
      'Nothing is waiting on a decision — every Application this Tenant received has ended.',
    );
    expect(noJobApplicationsMessage(read({}), true)).toBe(
      'Nothing on this Job is waiting on a decision — every Application it received has ended.',
    );
  });

  it('blames the filters ahead of what has ended, because they are what a reader can drop', () => {
    expect(noApplicationsMessage(read({ pipeline: 'interview' }), true)).toBe(
      'No Application matches that filter.',
    );
  });

  it('blames one filter or several, in the words each list uses', () => {
    const one = read({ pipeline: 'hired' });
    const two = read({ pipeline: 'hired', screening: ['pending'] });

    expect(noApplicationsMessage(one, false)).toBe('No Application matches that filter.');
    expect(noApplicationsMessage(two, false)).toBe('No Application matches these filters.');
    expect(noJobApplicationsMessage(one, false)).toBe(
      'No Application on this Job matches that filter.',
    );
    expect(noJobApplicationsMessage(two, false)).toBe(
      'No Application on this Job matches both filters.',
    );
  });

  it('offers to clear what it blamed, and says how many that is', () => {
    expect(clearFiltersLabel(read({ pipeline: 'hired' }))).toBe('Clear filter');
    expect(clearFiltersLabel(read({ pipeline: 'hired', received: '7d' }))).toBe('Clear filters');
  });
});
