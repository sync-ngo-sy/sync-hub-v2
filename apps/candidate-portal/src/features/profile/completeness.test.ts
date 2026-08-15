import { describe, expect, it } from 'vitest';
import fixture from '../../../../../fixtures/profile-completeness.json';
import {
  completionPercent,
  missingRequirements,
  type ProfileFacts,
  REQUIREMENTS,
  type Requirement,
} from './completeness';

interface SharedCase {
  name: string;
  facts: ProfileFacts;
  missing: Requirement[];
  percent: number;
}

const shared = fixture as { requirements: Requirement[]; cases: SharedCase[] };

it('asks for the requirements the shared fixture names', () => {
  expect([...REQUIREMENTS]).toEqual(shared.requirements);
});

describe.each(shared.cases)('$name', (example) => {
  it('reports the requirements it says are missing', () => {
    expect(missingRequirements(example.facts)).toEqual(example.missing);
  });

  it('is the percent it says it is', () => {
    expect(completionPercent(missingRequirements(example.facts))).toBe(example.percent);
  });
});
