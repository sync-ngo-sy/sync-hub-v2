import { describe, expect, it } from 'vitest';
import { assessmentProvenance, matchLabel } from './assessment';

const ASSESSMENT = {
  id: '00000000-0000-4000-8000-000000000601',
  is_current: true,
  match_percentage: 82,
  explanation: 'Answers both languages and most of the required skills.',
  strengths: ['Nine years of logistics'],
  gaps: ['No formal procurement training'],
  model_name: 'claude-sonnet-5',
  prompt_version: 'v3',
  assessed_at: '2026-08-03T09:00:00Z',
};

describe('how one match assessment reads', () => {
  it('says what the percentage measures, so it is not mistaken for a verdict', () => {
    expect(matchLabel(82)).toBe('82% of what the Job asks for');
  });

  it('rounds a percentage the model gave to a fraction', () => {
    expect(matchLabel(66.7)).toBe('67% of what the Job asks for');
  });

  it('names the model and the prompt that wrote it, so two readings can be told apart', () => {
    expect(assessmentProvenance(ASSESSMENT)).toBe('claude-sonnet-5 · prompt v3');
  });
});
