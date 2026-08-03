import type { components } from '@sync/api-client';

export type MatchAssessment = components['schemas']['MatchAssessment'];

/** Spelled out rather than shown as a bare "82%" with a coloured chip: this is advice drawn
 * from the Snapshot, and a chip beside the Screening verdict would read as a second verdict. */
export function matchLabel(percentage: number): string {
  return `${Math.round(percentage)}% of what the Job asks for`;
}

export function assessmentProvenance(assessment: MatchAssessment): string {
  return `${assessment.model_name} · prompt ${assessment.prompt_version}`;
}
