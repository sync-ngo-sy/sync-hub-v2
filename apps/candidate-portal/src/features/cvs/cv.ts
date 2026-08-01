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
  /** What the state means for the reader, said before they have to ask. */
  sentence: string;
}

export const PARSE_STATES: Record<Cv['parsing_status'], ParseState> = {
  uploaded: {
    label: 'Queued',
    tone: 'neutral',
    sentence: 'Waiting to be read. This page updates on its own.',
  },
  processing: {
    label: 'Reading',
    tone: 'neutral',
    sentence: 'Being read now. This page updates on its own.',
  },
  ready: {
    label: 'Ready',
    tone: 'positive',
    sentence: 'Read in full — it can fill your profile, and be the CV you apply with.',
  },
  failed: {
    label: "Couldn't be read",
    tone: 'negative',
    sentence: 'It cannot fill your profile or be made current. Upload another file instead.',
  },
};
