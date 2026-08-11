import { Alert, AlertDescription, AlertTitle } from '@sync/ui/components/ui/alert';
import { Button } from '@sync/ui/components/ui/button';
import { CircleAlert, ImageUp } from 'lucide-react';
import { type ChangeEvent, useRef, useState } from 'react';
import { toast } from 'sonner';
import { isClientError, problemMessage } from '@/lib/api-problem';
import { photoUpload, useUploadPhoto } from '../hooks/use-upload-photo';
import { PHOTO_FILE_ACCEPT, PHOTO_FORMATS, rejectionFor } from '../photo-check';
import { PhotoCropDialog } from './photo-crop-dialog';

export function PhotoPicker({ hasPhoto }: { hasPhoto: boolean }) {
  const upload = useUploadPhoto();
  const input = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<File | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);

  function choose(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const rejected = rejectionFor(file);
    setRefusal(rejected);
    if (!rejected) setPicked(file);
  }

  async function send(photo: Blob) {
    try {
      await upload.mutateAsync(photoUpload(photo));
      setPicked(null);
      toast.success('Photo saved.');
    } catch (error) {
      const message = problemMessage(error, "Your photo couldn't be saved. Try again.");
      if (isClientError(error)) {
        setPicked(null);
        setRefusal(message);
      } else {
        toast.error(message);
      }
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Button
          type="button"
          variant="outline"
          disabled={upload.isPending}
          onClick={() => input.current?.click()}
        >
          <ImageUp aria-hidden="true" />
          {hasPhoto ? 'Change photo' : 'Add a photo'}
        </Button>
        <p className="text-meta text-muted-foreground">
          {PHOTO_FORMATS}. You choose what the circle holds.
        </p>
      </div>

      {refusal ? (
        <Alert className="bg-muted">
          <CircleAlert aria-hidden="true" />
          <AlertTitle>That photo did not go through</AlertTitle>
          <AlertDescription>{refusal}</AlertDescription>
        </Alert>
      ) : null}

      <input
        ref={input}
        type="file"
        accept={PHOTO_FILE_ACCEPT}
        aria-label="Choose a profile photo"
        className="sr-only"
        onChange={choose}
      />

      {picked ? (
        <PhotoCropDialog
          file={picked}
          pending={upload.isPending}
          onCancel={() => setPicked(null)}
          onSave={send}
        />
      ) : null}
    </div>
  );
}
