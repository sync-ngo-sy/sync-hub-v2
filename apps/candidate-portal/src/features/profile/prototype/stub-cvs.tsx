// PROTOTYPE for #369 — throwaway. The CVs section, faked: an upload that never leaves the browser,
// a row that walks Queued → Reading → Ready, and a slot a variant can put its question in.
//
// The parse sentences are rewritten here. Production's `PARSE_STATES` still says "the fields below
// fill in"; this prototype says what the CV does to a profile, in the one word the page now uses.

import { StatusMark } from '@sync/ui/components/status-mark';
import { TruncatedText } from '@sync/ui/components/truncated-text';
import { Button } from '@sync/ui/components/ui/button';
import { LoaderCircle, Upload, Wand2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { CV_FORMATS, MAX_CV_MB } from '@/features/cvs/file-check';
import { isWaiting, type UpdateState } from './update-stub';

export const UPDATE_FROM_CV = 'Update your profile from this CV';

const READ = {
  tone: 'active',
  label: 'Ready',
  sentence: 'Read in full — it can update your profile, and be the CV you apply with.',
} as const;

const PHASE_STATE = {
  uploading: {
    tone: 'waiting',
    label: 'Queued',
    sentence: 'Waiting to be read. It can update your profile when it has been.',
  },
  reading: {
    tone: 'waiting',
    label: 'Reading',
    sentence: 'Being read now. It can update your profile when it has been.',
  },
  read: READ,
} as const;

interface StubCvsProps {
  state: UpdateState;
  onUpload: () => void;
  onUpdate: () => void;
  offer?: ReactNode;
}

function UpdateButton({ onUpdate, cvName }: { onUpdate: () => void; cvName: string }) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      aria-label={`Update your profile from “${cvName}”`}
      onClick={onUpdate}
    >
      <Wand2 aria-hidden="true" />
      {UPDATE_FROM_CV}
    </Button>
  );
}

export function StubCvs({ state, onUpload, onUpdate, offer }: StubCvsProps) {
  const waiting = isWaiting(state);
  const current = 'MWAFAK_ALMAHAINI_CV_2024.pdf';

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Button type="button" size="lg" disabled={waiting} onClick={onUpload}>
          <Upload aria-hidden="true" />
          {state.phase === 'uploading' ? 'Uploading…' : 'Upload a CV'}
        </Button>
        <p className="text-meta text-muted-foreground">
          {CV_FORMATS}, up to {MAX_CV_MB} MB. 4 of 5 slots free.
        </p>
      </div>

      <ul aria-label="Your CVs" className="space-y-4">
        {state.phase === 'idle' || !state.cvName ? null : (
          <li>
            <div className="min-w-0 space-y-4 rounded-lg border border-border p-3 md:p-4">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="min-w-0 font-heading text-base font-medium text-foreground">
                    <TruncatedText>{state.cvName}</TruncatedText>
                  </h3>
                  {waiting ? (
                    <LoaderCircle
                      role="progressbar"
                      aria-label={`Reading “${state.cvName}”`}
                      className="size-3.5 shrink-0 animate-spin text-muted-foreground"
                    />
                  ) : null}
                  <StatusMark
                    tone={PHASE_STATE[state.phase].tone}
                    label={PHASE_STATE[state.phase].label}
                  />
                </div>
                <p className="text-meta text-muted-foreground">Uploaded just now</p>
                <p className="text-dense text-muted-foreground">
                  {PHASE_STATE[state.phase].sentence}
                </p>
              </div>

              {offer}

              {state.phase === 'read' && !offer ? (
                <div className="flex flex-wrap gap-2">
                  <UpdateButton onUpdate={onUpdate} cvName={state.cvName} />
                </div>
              ) : null}
            </div>
          </li>
        )}

        <li>
          <div className="min-w-0 space-y-4 rounded-lg border border-border p-3 md:p-4">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="min-w-0 font-heading text-base font-medium text-foreground">
                  <TruncatedText>{current}</TruncatedText>
                </h3>
                <StatusMark tone="active" label="Current" />
                <StatusMark tone={READ.tone} label={READ.label} />
              </div>
              <p className="text-meta text-muted-foreground">
                Uploaded 7 months ago · Written in English
              </p>
              <p className="text-dense text-muted-foreground">{READ.sentence}</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <UpdateButton onUpdate={onUpdate} cvName={current} />
            </div>
          </div>
        </li>
      </ul>
    </div>
  );
}
