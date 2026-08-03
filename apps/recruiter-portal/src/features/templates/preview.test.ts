import { describe, expect, it } from 'vitest';
import { messagePreview, paragraphs } from './preview';
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

describe('the shape a previewed body is read in', () => {
  it('parts paragraphs on a blank line, the way the sent mail does', () => {
    expect(paragraphs('Hi Amal,\n\nWe would like to talk.\n\nAman Relief')).toEqual([
      'Hi Amal,',
      'We would like to talk.',
      'Aman Relief',
    ]);
  });

  it('keeps a single newline inside the paragraph it belongs to', () => {
    expect(paragraphs('Two things:\n- one\n- two')).toEqual(['Two things:\n- one\n- two']);
  });

  it('drops the emptiness left by trailing or repeated blank lines', () => {
    expect(paragraphs('Only this.\n\n\n\n')).toEqual(['Only this.']);
  });
});
