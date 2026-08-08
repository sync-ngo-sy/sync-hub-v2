import type { Crop } from 'react-image-crop';

export const UPLOAD_MEDIA_TYPE = 'image/webp';

const UPLOAD_QUALITY = 0.9;

const MAX_UPLOAD_PIXELS = 1024;

export interface PixelSquare {
  x: number;
  y: number;
  side: number;
}

export interface PhotoMetrics {
  naturalWidth: number;
  naturalHeight: number;
  width: number;
  height: number;
}

export function boundingSquare(crop: Crop, photo: PhotoMetrics): PixelSquare | null {
  const { naturalWidth, naturalHeight } = photo;
  if (naturalWidth <= 0 || naturalHeight <= 0) return null;

  const across = crop.unit === '%' ? naturalWidth / 100 : naturalWidth / (photo.width || 1);
  const down = crop.unit === '%' ? naturalHeight / 100 : naturalHeight / (photo.height || 1);

  const side = Math.round(Math.min(crop.width * across, crop.height * down));
  if (side <= 0) return null;

  return {
    x: Math.round(clamp(crop.x * across, 0, naturalWidth - side)),
    y: Math.round(clamp(crop.y * down, 0, naturalHeight - side)),
    side,
  };
}

export async function squareBlob(photo: CanvasImageSource, square: PixelSquare): Promise<Blob> {
  const side = Math.min(square.side, MAX_UPLOAD_PIXELS);
  const canvas = document.createElement('canvas');
  canvas.width = side;
  canvas.height = side;

  const surface = canvas.getContext('2d');
  if (!surface) throw new Error('This browser cannot cut out the photo.');
  surface.drawImage(photo, square.x, square.y, square.side, square.side, 0, 0, side, side);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('The cut-out photo came back empty.'))),
      UPLOAD_MEDIA_TYPE,
      UPLOAD_QUALITY,
    );
  });
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(Math.max(value, low), Math.max(low, high));
}
