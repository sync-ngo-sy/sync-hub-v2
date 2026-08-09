import { z } from 'zod';
import { PIPELINE_STATUSES, RECEIVED_WITHIN_VALUES, SCREENING_VERDICTS } from '../application';

export const pipelineStatuses = z.array(z.enum(PIPELINE_STATUSES)).min(1);

export const screeningVerdicts = z.array(z.enum(SCREENING_VERDICTS)).min(1);

export const receivedWithinWindow = z.enum(RECEIVED_WITHIN_VALUES);
