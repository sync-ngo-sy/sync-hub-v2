import { z } from 'zod';
import {
  APPLICATION_SORTS,
  PIPELINE_STATUSES,
  pipelineTab,
  RECEIVED_WITHIN_VALUES,
  SCREENING_VERDICTS,
} from '../application';

function unique<TValue>(values: TValue[]): TValue[] {
  return [...new Set(values)];
}

export const pipelineStatuses = z.array(z.enum(PIPELINE_STATUSES)).min(1).transform(unique);

export const pipelineTabSelection = pipelineStatuses.transform(pipelineTab);

export const screeningVerdicts = z.array(z.enum(SCREENING_VERDICTS)).min(1).transform(unique);

export const receivedWithinWindow = z.enum(RECEIVED_WITHIN_VALUES);

export const applicationSort = z.enum(APPLICATION_SORTS);
