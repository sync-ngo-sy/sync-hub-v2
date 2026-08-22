import { z } from 'zod';
import {
  APPLICATION_SORTS,
  PIPELINE_STATUSES,
  PIPELINE_TABS,
  pipelineFromShorthand,
  RECEIVED_WITHIN_VALUES,
  SCREENING_VERDICTS,
} from '../application';

function unique<TValue>(values: TValue[]): TValue[] {
  return [...new Set(values)];
}

/** The stages a Reading shows, as an array — the shape the Screening filter already has, so the
 * two controls read the same way and a sweep can act on exactly what is filtered.
 *
 * A single value is still honoured, because addresses were written that way before the filter
 * could hold more than one stage: `open` and `all` were shorthands for a set of stages, and one
 * status alone was a set of one. So a link copied then still reproduces the list it was copied
 * from, which is the whole point of an Address.
 */
export const pipelineTabSelection = z.union([
  z.array(z.enum(PIPELINE_STATUSES)).min(1).transform(unique),
  z.enum(PIPELINE_TABS).transform(pipelineFromShorthand),
]);

export const screeningVerdicts = z.array(z.enum(SCREENING_VERDICTS)).min(1).transform(unique);

export const receivedWithinWindow = z.enum(RECEIVED_WITHIN_VALUES);

export const applicationSort = z.enum(APPLICATION_SORTS);
