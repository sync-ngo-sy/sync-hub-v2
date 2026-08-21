import { z } from 'zod';
import {
  APPLICATION_SORTS,
  PIPELINE_TABS,
  RECEIVED_WITHIN_VALUES,
  SCREENING_VERDICTS,
} from '../application';

function unique<TValue>(values: TValue[]): TValue[] {
  return [...new Set(values)];
}

export const pipelineTabSelection = z.enum(PIPELINE_TABS);

export const screeningVerdicts = z.array(z.enum(SCREENING_VERDICTS)).min(1).transform(unique);

export const receivedWithinWindow = z.enum(RECEIVED_WITHIN_VALUES);

export const applicationSort = z.enum(APPLICATION_SORTS);
