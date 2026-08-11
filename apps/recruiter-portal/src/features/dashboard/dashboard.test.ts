import { describe, expect, it } from 'vitest';
import { dashboardDate, dashboardGreeting } from './dashboard';

describe('the Dashboard heading', () => {
  it('greets the recruiter by first name in the morning', () => {
    const morning = new Date(2026, 7, 9, 11, 59);

    expect(dashboardGreeting('Yara Haddad', morning)).toBe('Good morning, Yara');
  });

  it('greets the recruiter in the evening from noon', () => {
    const noon = new Date(2026, 7, 9, 12);

    expect(dashboardGreeting('Yara Haddad', noon)).toBe('Good evening, Yara');
  });

  it('writes the local date in the heading', () => {
    const sunday = new Date(2026, 7, 9, 9);

    expect(dashboardDate(sunday)).toBe('Sunday, 9 August 2026');
  });
});
