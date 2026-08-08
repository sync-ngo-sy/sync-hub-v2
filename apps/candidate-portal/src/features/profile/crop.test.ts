import type { Crop } from 'react-image-crop';
import { describe, expect, it, vi } from 'vitest';
import {
  boundingSquare,
  centeredSquare,
  type PhotoMetrics,
  type PixelSquare,
  squareBlob,
} from './crop';

const PHOTO: PhotoMetrics = { naturalWidth: 2000, naturalHeight: 1000, width: 500, height: 250 };

function square(crop: Crop, photo: PhotoMetrics = PHOTO): PixelSquare {
  const cut = boundingSquare(crop, photo);
  if (!cut) throw new Error('expected a square');
  return cut;
}

describe('the square behind the circle', () => {
  it('reads a percentage selection against the photo it was drawn on', () => {
    expect(square({ unit: '%', x: 10, y: 20, width: 25, height: 50 })).toEqual({
      x: 200,
      y: 200,
      side: 500,
    });
  });

  it('scales a selection drawn on screen up to the photo own pixels', () => {
    expect(square({ unit: 'px', x: 50, y: 25, width: 100, height: 100 })).toEqual({
      x: 200,
      y: 100,
      side: 400,
    });
  });

  it('takes the shorter side when the selection is not square', () => {
    expect(square({ unit: '%', x: 0, y: 0, width: 50, height: 10 }).side).toBe(100);
  });

  it('keeps the square inside the photo when the selection runs off it', () => {
    const cut = square({ unit: '%', x: 90, y: 90, width: 50, height: 50 });

    expect(cut.x).toBeGreaterThanOrEqual(0);
    expect(cut.y).toBeGreaterThanOrEqual(0);
    expect(cut.x + cut.side).toBeLessThanOrEqual(PHOTO.naturalWidth);
    expect(cut.y + cut.side).toBeLessThanOrEqual(PHOTO.naturalHeight);
  });

  it('never asks for more than the photo has', () => {
    expect(square({ unit: '%', x: 0, y: 0, width: 100, height: 100 }).side).toBe(1000);
  });

  it('has nothing to take from a photo that has not loaded', () => {
    const nothing = boundingSquare(
      { unit: '%', x: 0, y: 0, width: 100, height: 100 },
      { naturalWidth: 0, naturalHeight: 0, width: 0, height: 0 },
    );

    expect(nothing).toBeNull();
  });

  it('centres a displayed square rather than a natural-size square', () => {
    expect(centeredSquare(600, 400)).toEqual({
      unit: '%',
      x: expect.closeTo(23.333, 3),
      y: 10,
      width: expect.closeTo(53.333, 3),
      height: 80,
    });
  });

  it('draws the selected source square into the upload canvas', async () => {
    const drawImage = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage,
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((done) => {
      done(new Blob([new Uint8Array(1)], { type: 'image/webp' }));
    });
    const photo = document.createElement('img');

    await squareBlob(photo, { x: 20, y: 30, side: 400 });

    expect(drawImage).toHaveBeenCalledWith(photo, 20, 30, 400, 400, 0, 0, 400, 400);
  });
});
