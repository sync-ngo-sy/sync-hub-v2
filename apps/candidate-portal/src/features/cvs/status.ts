import type { components } from '@sync/api-client/schema';
import type { ChipStatus } from '@sync/ui/components/status-chip';

export type Cv = components['schemas']['Cv'];
export type CvParsingStatus = components['schemas']['CvParsingStatus'];

export function isParsing(cv: Cv): boolean {
  return cv.parsing_status === 'uploaded' || cv.parsing_status === 'processing';
}

export function isReady(cv: Cv): boolean {
  return cv.parsing_status === 'ready';
}

export const PARSE_LABELS: Record<CvParsingStatus, { label: string; chip: ChipStatus }> = {
  uploaded: { label: 'Uploaded', chip: 'pending' },
  processing: { label: 'Reading…', chip: 'reviewing' },
  ready: { label: 'Ready', chip: 'qualified' },
  failed: { label: "Couldn't read", chip: 'rejected' },
};
