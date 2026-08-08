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

export function centeredSquare(width: number, height: number): Crop {
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

export function boundingSquare(crop: Crop, photo: PhotoMetrics): PixelSquare | null {
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
