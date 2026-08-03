import { describe, expect, it } from 'vitest';
import { messageTemplateFormSchema } from './message-template';

const A_BLANK_FORM = { name: '', subject: '', body: '' };

const FILLED = {
  name: 'Interview invitation',
  subject: 'An interview for {{ job_title }}?',
  body: 'Hi {{ candidate_name }},\n\nCome and talk to us.\n\n{{ tenant_name }}',
};

describe('a Message template form', () => {
  it('requires a name, a subject and a body after whitespace is removed', () => {
    const result = messageTemplateFormSchema.safeParse({ ...A_BLANK_FORM, name: '   ' });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.flatten().fieldErrors).toMatchObject({
      name: ['Name this template.'],
      subject: ['Write a subject line.'],
      body: ['Write the message.'],
    });
  });

  it('takes a template that uses every placeholder a send can fill', () => {
    expect(messageTemplateFormSchema.safeParse(FILLED).success).toBe(true);
  });

  it('refuses a placeholder no send could fill, naming it', () => {
    const result = messageTemplateFormSchema.safeParse({
      ...FILLED,
      subject: 'An interview at {{ company }}?',
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.flatten().fieldErrors.subject).toEqual([
      'Nothing can fill {{ company }}. Use {{ candidate_name }}, {{ job_title }} or {{ tenant_name }}.',
    ]);
  });

  it('reads a malformed placeholder as one nothing can fill', () => {
    const result = messageTemplateFormSchema.safeParse({
      ...FILLED,
      body: 'Hi {{ Candidate Name }}, come and talk to us.',
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.flatten().fieldErrors.body?.[0]).toContain('{{ Candidate Name }}');
  });

  it('holds the name and subject to the line length the API takes', () => {
    const tooLong = 'x'.repeat(201);
    const result = messageTemplateFormSchema.safeParse({
      ...FILLED,
      name: tooLong,
      subject: tooLong,
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.flatten().fieldErrors).toMatchObject({
      name: ['Keep the name to 200 characters or fewer.'],
      subject: ['Keep the subject to 200 characters or fewer.'],
    });
    expect(messageTemplateFormSchema.safeParse({ ...FILLED, name: 'x'.repeat(200) }).success).toBe(
      true,
    );
  });

  it('holds the body to the paragraph length the API takes', () => {
    const result = messageTemplateFormSchema.safeParse({ ...FILLED, body: 'x'.repeat(5_001) });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.flatten().fieldErrors.body).toEqual([
      'Keep the message to 5,000 characters or fewer.',
    ]);
    expect(
      messageTemplateFormSchema.safeParse({ ...FILLED, body: 'x'.repeat(5_000) }).success,
    ).toBe(true);
  });

  it('minds neither the spacing inside the braces nor how many placeholders repeat', () => {
    const result = messageTemplateFormSchema.safeParse({
      ...FILLED,
      body: 'Hi {{candidate_name}}, {{ job_title  }} is open. — {{candidate_name}}',
    });

    expect(result.success).toBe(true);
  });
});
