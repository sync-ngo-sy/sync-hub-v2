import type { components } from '@sync/api-client';
import type { StatusTone } from '@sync/ui/components/status-chip';

export type Cv = components['schemas']['Cv'];

export const MAX_CVS = 5;

export function isParsing(cv: Cv): boolean {
  return cv.parsing_status === 'uploaded' || cv.parsing_status === 'processing';
}

export function isReady(cv: Cv): boolean {
  return cv.parsing_status === 'ready';
}

export function hasFailed(cv: Cv): boolean {
  return cv.parsing_status === 'failed';
}

export function slotsLeft(cvs: Cv[]): number {
  return Math.max(MAX_CVS - cvs.length, 0);
}

const LANGUAGES = new Intl.DisplayNames(undefined, { type: 'language' });

export function languageName(code: string): string {
  try {
    return LANGUAGES.of(code) ?? code;
  } catch {
    return code;
  }
}

interface ParseState {
  label: string;
  tone: StatusTone;
  sentence: string;
}

export const PARSE_STATES: Record<Cv['parsing_status'], ParseState> = {
  uploaded: {
    label: 'Queued',
    tone: 'neutral',
    sentence: 'Waiting to be read. The fields below fill in when it has been.',
  },
  processing: {
    label: 'Reading',
    tone: 'neutral',
    sentence: 'Being read now. The fields below fill in when it has been.',
  },
  ready: {
    label: 'Ready',
    tone: 'positive',
    sentence: 'Read in full — it can fill the form below, and be the CV you apply with.',
  },
  failed: {
    label: "Couldn't be read",
    tone: 'negative',
    sentence: 'It cannot fill the form below or be made current. Upload another file instead.',
  },
};
