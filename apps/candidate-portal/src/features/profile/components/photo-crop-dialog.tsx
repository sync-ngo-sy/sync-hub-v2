import { Button } from '@sync/ui/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@sync/ui/components/ui/dialog';
import { type SyntheticEvent, useEffect, useRef, useState } from 'react';
import ReactCrop, { type Crop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { boundingSquare, centeredSquare, squareBlob } from '../crop';

interface PhotoCropDialogProps {
  file: File;
  pending: boolean;
  onCancel: () => void;
  onSave: (photo: Blob) => void;
}

export function PhotoCropDialog({ file, pending, onCancel, onSave }: PhotoCropDialogProps) {
  const [source, setSource] = useState<string | null>(null);
  const [crop, setCrop] = useState<Crop | null>(null);
  const [unreadable, setUnreadable] = useState(false);
  const photo = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const reader = new FileReader();
    const read = () => setSource(String(reader.result));
    reader.addEventListener('load', read);
    reader.readAsDataURL(file);
    return () => reader.removeEventListener('load', read);
  }, [file]);

  /** The photo's own pixels, not the ones it is laid out at: the two are in the same proportion,
   * and a circle drawn before the browser has measured the element would come out an oval. */
  function centreTheCircleOn(event: SyntheticEvent<HTMLImageElement>) {
    setCrop(framing(event.currentTarget));
  }

  async function save() {
    const image = photo.current;
    const square = image && boundingSquare(crop ?? framing(image), image);
    if (!image || !square) {
      setUnreadable(true);
      return;
    }
    onSave(await squareBlob(image, square));
  }

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next && !pending) onCancel();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Frame your photo</DialogTitle>
          <DialogDescription>
            Drag and resize the circle. What is inside it is what recruiters see.
          </DialogDescription>
        </DialogHeader>

        {source ? (
          <ReactCrop
            crop={crop ?? undefined}
            onChange={(_, percent) => setCrop(percent)}
            aspect={1}
            circularCrop
            keepSelection
            minWidth={32}
            style={{ maxHeight: '50vh' }}
          >
            <img
              ref={photo}
              src={source}
              alt="The one you picked, ready to be framed"
              onLoad={centreTheCircleOn}
              className="max-w-full"
              style={{ maxHeight: '50vh' }}
            />
          </ReactCrop>
        ) : (
          <p className="text-meta text-muted-foreground">Opening your photo…</p>
        )}

        {unreadable ? (
          <p role="alert" className="text-meta text-destructive">
            That photo could not be read. Pick another one.
          </p>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="outline" disabled={pending} onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" disabled={pending || !source} onClick={save}>
            {pending ? 'Uploading…' : 'Use this photo'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function framing(photo: HTMLImageElement): Crop {
  return centeredSquare(photo.naturalWidth, photo.naturalHeight);
}
