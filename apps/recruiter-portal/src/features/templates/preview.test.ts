import { describe, expect, it } from 'vitest';
import { messagePreview } from './preview';
import { INTERVIEW_INVITATION } from './testing/fixtures';

const FILLED = {
  candidate_name: 'Amal Haddad',
  job_title: 'Field Coordinator',
  tenant_name: 'Aman Relief',
};

describe('a Message template previewed against one Application', () => {
  it('reads as the words the candidate will read, not as braces', () => {
    const preview = messagePreview(INTERVIEW_INVITATION, FILLED);

    expect(preview.subject).toBe('An interview for Field Coordinator?');
    expect(preview.body).toBe(
      'Hi Amal Haddad,\n\nWe would like to talk to you about Field Coordinator.\n\nAman Relief',
    );
  });

  it('fills a placeholder however the writer spaced it', () => {
    const preview = messagePreview(
      { ...INTERVIEW_INVITATION, subject: '{{job_title}}', body: '{{   candidate_name   }}' },
      FILLED,
    );

    expect(preview.subject).toBe('Field Coordinator');
    expect(preview.body).toBe('Amal Haddad');
  });

  it('fills every mention of the same placeholder, not only the first', () => {
    const preview = messagePreview(
      { ...INTERVIEW_INVITATION, subject: '{{ job_title }} — {{ job_title }}', body: 'x' },
      FILLED,
    );

    expect(preview.subject).toBe('Field Coordinator — Field Coordinator');
  });

  it('leaves a name nothing can fill exactly as it was written', () => {
    const preview = messagePreview(
      { ...INTERVIEW_INVITATION, subject: 'Hi {{ recruiter_name }}', body: 'x' },
      FILLED,
    );

    expect(preview.subject).toBe('Hi {{ recruiter_name }}');
  });
});
