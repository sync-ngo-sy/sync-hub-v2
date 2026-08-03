import type { MessageTemplate } from '../message-template';

export const INTERVIEW_INVITATION: MessageTemplate = {
  id: '00000000-0000-4000-8000-000000000301',
  name: 'Interview invitation',
  subject: 'An interview for {{ job_title }}?',
  body: 'Hi {{ candidate_name }},\n\nWe would like to talk to you about {{ job_title }}.\n\n{{ tenant_name }}',
  created_at: '2026-07-20T09:00:00Z',
  updated_at: '2026-07-22T09:00:00Z',
};

export const THANKS_BUT_NO: MessageTemplate = {
  id: '00000000-0000-4000-8000-000000000302',
  name: 'Thanks, but not this time',
  subject: 'Your application for {{ job_title }}',
  body: 'Hi {{ candidate_name }},\n\nWe are moving other applicants forward.\n\n{{ tenant_name }}',
  created_at: '2026-07-18T09:00:00Z',
  updated_at: '2026-07-18T09:00:00Z',
};
