import type { components } from '@sync/api-client';

export type MatchAssessment = components['schemas']['MatchAssessment'];

export type MatchScore = components['schemas']['MatchScore'];

export function matchLabel(percentage: number): string {
  return `${Math.round(percentage)}% of what the Job asks for`;
}

export function assessmentProvenance(assessment: MatchAssessment): string {
  return `${assessment.model_name} · prompt ${assessment.prompt_version}`;
}
