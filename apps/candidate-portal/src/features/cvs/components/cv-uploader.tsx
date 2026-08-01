import { EmptyState } from '@sync/ui/components/empty-state';
import { Alert, AlertDescription, AlertTitle } from '@sync/ui/components/ui/alert';
import { Button } from '@sync/ui/components/ui/button';
import { CircleAlert, FileText, Upload } from 'lucide-react';
import { type ChangeEvent, type ReactNode, useRef, useState } from 'react';
import { toast } from 'sonner';
import { isClientError, problemMessage } from '@/lib/api-problem';
import { MAX_CVS } from '../cv';
import { CV_FILE_ACCEPT, CV_FORMATS, MAX_CV_MB, rejectionFor } from '../file-check';
import { cvUpload, useUploadCv } from '../hooks/use-upload-cv';

interface CvUploaderProps {
  slotsLeft: number;
  /** With none kept, the uploader *is* the list's empty state rather than a bar above it. */
  hasCvs: boolean;
}

export function CvUploader({ slotsLeft, hasCvs }: CvUploaderProps) {
  const upload = useUploadCv();
  const input = useRef<HTMLInputElement>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);

  async function send(file: File) {
    setUploading(file.name);
    try {
      const cv = await upload.mutateAsync(cvUpload(file));
      toast.success(`“${cv.display_name}” uploaded. We're reading it now.`);
    } catch (error) {
      const message = problemMessage(error, "Couldn't upload that file. Try again.");
      // A refused file is about the file, so it belongs beside the picker. A fault on our
      // side is nobody's file, and goes to Sonner instead (§7.2, §7.3).
      if (isClientError(error)) setRefusal(message);
      else toast.error(message);
    } finally {
      setUploading(null);
    }
  }

  async function choose(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Cleared so that picking the same file twice still fires a change event.
    event.target.value = '';
    if (!file) return;

    const rejected = rejectionFor(file);
    setRefusal(rejected);
    if (!rejected) await send(file);
  }

  if (slotsLeft === 0) {
    return (
      <Alert>
        <CircleAlert aria-hidden="true" />
        <AlertTitle>You are keeping all {MAX_CVS} CVs we hold</AlertTitle>
        <AlertDescription>
          Delete one you no longer need and the slot comes back, along with the ability to upload
          again.
        </AlertDescription>
      </Alert>
    );
  }

  const trigger = (
    <Button
      type="button"
      size="lg"
      disabled={uploading !== null}
      onClick={() => input.current?.click()}
    >
      <Upload aria-hidden="true" />
      {uploading ? 'Uploading…' : hasCvs ? 'Upload a CV' : 'Upload your first CV'}
    </Button>
  );

  const constraints = `${CV_FORMATS}, up to ${MAX_CV_MB} MB. ${slotsLeft} of ${MAX_CVS} slots free.`;

  return (
    <Shell
      hasCvs={hasCvs}
      trigger={trigger}
      constraints={constraints}
      notices={
        <>
          {uploading ? <UploadProgress name={uploading} /> : null}
          {refusal ? (
            <Alert variant="destructive">
              <CircleAlert aria-hidden="true" />
              <AlertTitle>That file did not go through</AlertTitle>
              <AlertDescription>{refusal}</AlertDescription>
            </Alert>
          ) : null}
        </>
      }
    >
      <input
        ref={input}
        type="file"
        accept={CV_FILE_ACCEPT}
        aria-label="Choose a CV file"
        className="sr-only"
        onChange={choose}
      />
    </Shell>
  );
}

function Shell({
  hasCvs,
  trigger,
  constraints,
  notices,
  children,
}: {
  hasCvs: boolean;
  trigger: ReactNode;
  constraints: string;
  notices: ReactNode;
  children: ReactNode;
}) {
  if (!hasCvs) {
    return (
      <div aria-live="polite" className="space-y-3">
        <EmptyState
          icon={FileText}
          message="No CVs yet. Upload one and we'll read it, fill your profile from it, and send it with the applications you make."
          action={trigger}
        />
        <p className="text-center text-meta text-muted-foreground">{constraints}</p>
        {notices}
        {children}
      </div>
    );
  }

  return (
    <div aria-live="polite" className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {trigger}
        <p className="text-meta text-muted-foreground">{constraints}</p>
      </div>
      {notices}
      {children}
    </div>
  );
}

/**
 * Indeterminate on purpose: the request goes through `openapi-fetch` (ADR-0008), and `fetch`
 * cannot report how many bytes have left the browser. A percentage here would be invented.
 */
function UploadProgress({ name }: { name: string }) {
  return (
    <div className="space-y-1.5">
      <p className="text-meta text-muted-foreground">Uploading “{name}”…</p>
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
