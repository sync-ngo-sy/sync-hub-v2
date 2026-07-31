import { Button } from '@sync/ui/components/ui/button';
import { Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { ACCEPTED_LABEL, CV_CAP, FILE_ACCEPT_ATTR, MAX_FILE_LABEL } from '../constants';
import { useUploadCv } from '../hooks/use-upload-cv';
import { uploadErrorMessage } from '../messages';
import { validateCvFile } from '../schemas/upload-schema';

export function CvUploader({ cvCount }: { cvCount: number }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const upload = useUploadCv();
  const [error, setError] = useState<string | null>(null);
  const [pendingName, setPendingName] = useState<string | null>(null);

  const atCap = cvCount >= CV_CAP;

  async function onFileChosen(file: File) {
    const problem = validateCvFile(file);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setPendingName(file.name);
    try {
      await upload.mutateAsync(file);
      toast.success(`${file.name} uploaded — reading it now.`);
    } catch (uploadError) {
      setError(uploadErrorMessage(uploadError));
    } finally {
      setPendingName(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Button disabled={atCap || upload.isPending} onClick={() => inputRef.current?.click()}>
          <Upload aria-hidden />
          Upload CV
        </Button>
        <p className="text-sm text-muted-foreground">
          {atCap
            ? `You've reached the maximum of ${CV_CAP} CVs. Delete one to upload another.`
            : `${ACCEPTED_LABEL}, up to ${MAX_FILE_LABEL}. ${cvCount} of ${CV_CAP} used.`}
        </p>
        <input
          ref={inputRef}
          type="file"
          accept={FILE_ACCEPT_ATTR}
          className="sr-only"
          aria-hidden
          tabIndex={-1}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) void onFileChosen(file);
          }}
        />
      </div>
      {upload.isPending && pendingName ? (
        <div className="space-y-1.5" aria-live="polite">
          <p className="text-sm text-muted-foreground">Uploading {pendingName}…</p>
          <div
            role="progressbar"
            aria-label={`Uploading ${pendingName}`}
            className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
          >
            <div className="h-full w-1/3 animate-pulse rounded-full bg-primary" />
          </div>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-destructive-foreground">
          {error}
        </p>
      ) : null}
    </div>
  );
}
