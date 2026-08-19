/**
 * VARIANT A — today's code. `crop.ts` is reproduced below character for character, and the
 * ReactCrop block carries the props and the styles `photo-crop-dialog.tsx` gives it, so the
 * reproduction is trustworthy. Do not tidy any of it.
 */
import { type SyntheticEvent, useEffect, useRef, useState } from 'react';
import ReactCrop, { type Crop } from 'react-image-crop';
import { ovalness, placementOf } from '../geometry';
import type { VariantProps } from '../variant';

// ------------------------------------------------------------------ crop.ts, verbatim
interface PixelSquare {
  x: number;
  y: number;
  side: number;
}

interface PhotoMetrics {
  naturalWidth: number;
  naturalHeight: number;
  width: number;
  height: number;
}

function centeredSquare(width: number, height: number): Crop {
  const side = Math.min(width, height) * 0.8;
  const cropWidth = (side / width) * 100;
  const cropHeight = (side / height) * 100;
  return {
    unit: '%',
    x: (100 - cropWidth) / 2,
    y: (100 - cropHeight) / 2,
    width: cropWidth,
    height: cropHeight,
  };
}

function boundingSquare(crop: Crop, photo: PhotoMetrics): PixelSquare | null {
  const { naturalWidth, naturalHeight } = photo;
  if (naturalWidth <= 0 || naturalHeight <= 0) return null;

  const percent = crop.unit === '%';
  const across = percent ? naturalWidth / 100 : naturalWidth / (photo.width || 1);
  const down = percent ? naturalHeight / 100 : naturalHeight / (photo.height || 1);

  const side = Math.round(Math.min(crop.width * across, crop.height * down));
  if (side <= 0) return null;

  return {
    x: Math.round(clamp(crop.x * across, 0, naturalWidth - side)),
    y: Math.round(clamp(crop.y * down, 0, naturalHeight - side)),
    side,
  };
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(Math.max(value, low), Math.max(low, high));
}

function framing(photo: HTMLImageElement): Crop {
  return centeredSquare(photo.naturalWidth, photo.naturalHeight);
}
// -------------------------------------------------------------- end of crop.ts, verbatim

export function VariantAToday({ src, onReading }: VariantProps) {
  const [crop, setCrop] = useState<Crop | null>(null);
  const photo = useRef<HTMLImageElement>(null);
  const around = useRef<HTMLDivElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: the picked photo resets the framing
  useEffect(() => setCrop(null), [src]);

  function centreTheCircleOn(event: SyntheticEvent<HTMLImageElement>) {
    setCrop(framing(event.currentTarget));
  }

  useEffect(() => {
    const image = photo.current;
    const wrapper = around.current?.querySelector('.ReactCrop');
    if (!image || !wrapper || !crop) return;

    const placement = placementOf(image, wrapper);
    onReading({
      placement,
      selection: crop,
      square: boundingSquare(crop, image),
      ovalness: ovalness(crop, placement.wrapper),
      photo: image,
    });
  }, [crop, onReading]);

  return (
    <div ref={around}>
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
          src={src}
          alt="The one you picked, ready to be framed"
          onLoad={centreTheCircleOn}
          className="max-w-full"
          style={{ maxHeight: '50vh' }}
        />
      </ReactCrop>
    </div>
  );
}
