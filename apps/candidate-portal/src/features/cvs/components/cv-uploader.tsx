import { EmptyState } from '@sync/ui/components/empty-state';
import { TruncatedText } from '@sync/ui/components/truncated-text';
import { Alert, AlertDescription, AlertTitle } from '@sync/ui/components/ui/alert';
import { Button } from '@sync/ui/components/ui/button';
import { CircleAlert, FileText, Upload } from 'lucide-react';
import { type ChangeEvent, useRef, useState } from 'react';
import { toast } from 'sonner';
import { isClientError, problemMessage } from '@/lib/api-problem';
import { type Cv, MAX_CVS } from '../cv';
import { CV_FILE_ACCEPT, CV_FORMATS, MAX_CV_MB, rejectionFor } from '../file-check';
import { cvUpload, useUploadCv } from '../hooks/use-upload-cv';

interface CvUploaderProps {
  slotsLeft: number;
  hasCvs: boolean;
  onUploaded: (cv: Cv) => void;
}

export function CvUploader({ slotsLeft, hasCvs, onUploaded }: CvUploaderProps) {
  const upload = useUploadCv();
  const input = useRef<HTMLInputElement>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);

  async function send(file: File) {
    setUploading(file.name);
    try {
      const cv = await upload.mutateAsync(cvUpload(file));
      onUploaded(cv);
      toast.success(`“${cv.display_name}” uploaded. We're reading it now.`);
    } catch (error) {
      const message = problemMessage(error, "Couldn't upload that file. Try again.");
      if (isClientError(error)) setRefusal(message);
      else toast.error(message);
    } finally {
      setUploading(null);
    }
  }

  async function choose(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const rejected = rejectionFor(file);
    setRefusal(rejected);
    if (!rejected) await send(file);
  }

  const atCap = slotsLeft === 0;
  const capId = 'cv-cap-explanation';

  const trigger = (
    <Button
      type="button"
      size="lg"
      disabled={atCap || uploading !== null}
      aria-describedby={atCap ? capId : undefined}
      onClick={() => input.current?.click()}
    >
      <Upload aria-hidden="true" />
      {uploading ? 'Uploading…' : hasCvs ? 'Upload a CV' : 'Upload your first CV'}
    </Button>
  );

  const constraints = atCap
    ? `${CV_FORMATS}, up to ${MAX_CV_MB} MB. No slots free.`
    : `${CV_FORMATS}, up to ${MAX_CV_MB} MB. ${slotsLeft} of ${MAX_CVS} slots free.`;

  return (
    <div aria-live="polite" className="space-y-3">
      {hasCvs ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {trigger}
          <p className="text-meta text-muted-foreground">{constraints}</p>
        </div>
      ) : (
        <>
          <EmptyState
            icon={FileText}
            message="No CVs yet. Upload one and we'll read it and update the fields below from it."
            action={trigger}
          />
          <p className="text-center text-meta text-muted-foreground">{constraints}</p>
        </>
      )}

      {atCap ? (
        <Alert id={capId}>
          <CircleAlert aria-hidden="true" />
          <AlertTitle>You are keeping all {MAX_CVS} CVs we hold</AlertTitle>
          <AlertDescription>
            Delete one you no longer need and the slot comes back, along with the ability to upload
            again.
          </AlertDescription>
        </Alert>
      ) : null}

      {uploading ? <UploadProgress name={uploading} /> : null}

      {refusal ? (
        <Alert className="bg-muted">
          <CircleAlert aria-hidden="true" />
          <AlertTitle>That file did not go through</AlertTitle>
          <AlertDescription>{refusal}</AlertDescription>
        </Alert>
      ) : null}

      {atCap ? null : (
        <input
          ref={input}
          type="file"
          accept={CV_FILE_ACCEPT}
          aria-label="Choose a CV file"
          className="sr-only"
          onChange={choose}
        />
      )}
    </div>
  );
}

function UploadProgress({ name }: { name: string }) {
  return (
    <div className="space-y-1.5">
      <p className="text-meta text-muted-foreground">Uploading…</p>
      <TruncatedText className="text-meta text-muted-foreground">{name}</TruncatedText>
      <div
        role="progressbar"
        aria-label={`Uploading “${name}”`}
        className="h-1 w-full overflow-hidden rounded-full bg-muted"
      >
        <div className="h-full w-full animate-pulse rounded-full bg-primary" />
      </div>
    </div>
  );
}
