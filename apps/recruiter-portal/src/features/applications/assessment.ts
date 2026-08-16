import type { components } from '@sync/api-client';

export type MatchAssessment = components['schemas']['MatchAssessment'];

export type MatchScore = components['schemas']['MatchScore'];

export const NO_REASONS = 'The model gave no reasons for this reading.';

export function matchLabel(percentage: number): string {
  return `${Math.round(percentage)}% strength for this Job`;
}

export function assessmentProvenance(assessment: MatchAssessment): string {
  return `${assessment.model_name} · prompt ${assessment.prompt_version}`;
}
