import { describe, expect, it } from 'vitest';
import { messageDraft } from './draft';
import { INTERVIEW_INVITATION } from './testing/fixtures';

const FILLED = {
  candidate_name: 'Amal Haddad',
  job_title: 'Field Coordinator',
  tenant_name: 'Aman Relief',
};

describe('the draft a Message template opens against one Application', () => {
  it('reads as the words the candidate will read, not as braces', () => {
    const draft = messageDraft(INTERVIEW_INVITATION, FILLED);

    expect(draft.subject).toBe('An interview for Field Coordinator?');
    expect(draft.body).toBe(
      'Hi Amal Haddad,\n\nWe would like to talk to you about Field Coordinator.\n\nAman Relief',
    );
  });

  it('fills a placeholder however the writer spaced it', () => {
    const draft = messageDraft(
      { ...INTERVIEW_INVITATION, subject: '{{job_title}}', body: '{{   candidate_name   }}' },
      FILLED,
    );

    expect(draft.subject).toBe('Field Coordinator');
    expect(draft.body).toBe('Amal Haddad');
  });

  it('fills every mention of the same placeholder, not only the first', () => {
    const draft = messageDraft(
      { ...INTERVIEW_INVITATION, subject: '{{ job_title }} — {{ job_title }}', body: 'x' },
      FILLED,
    );

    expect(draft.subject).toBe('Field Coordinator — Field Coordinator');
  });

  it('leaves a name nothing can fill exactly as it was written', () => {
    const draft = messageDraft(
      { ...INTERVIEW_INVITATION, subject: 'Hi {{ recruiter_name }}', body: 'x' },
      FILLED,
    );

    expect(draft.subject).toBe('Hi {{ recruiter_name }}');
  });
});
