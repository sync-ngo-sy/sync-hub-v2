/**
 * PROTOTYPE — the portable bit. Everything else under features/crop-prototype is a throwaway
 * shell around this file, which is the shape proposed for packages/ui: pure functions over a
 * source photo and a selection, no React, no fetching, no modal.
 *
 * A selection drawn on screen lives in one of three boxes, and today's code confuses them:
 *
 *   wrapper   the box react-image-crop measures and positions the selection against
 *   rendered  the box the photo is actually painted in, which sits inside the wrapper
 *   natural   the photo's own pixels, which is what gets uploaded
 *
 * The wrapper and the rendered photo are one box only while nothing caps the photo's height.
 * `max-height: 50vh` caps it, so a tall photo goes narrow inside a wrapper that stays wide,
 * and the two part company.
 */

export interface Box {
  width: number;
  height: number;
}

export interface Placement {
  wrapper: Box;
  rendered: Box;
  offsetX: number;
  offsetY: number;
  natural: Box;
}

export interface Selection {
  unit: '%' | 'px';
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SourceSquare {
  x: number;
  y: number;
  side: number;
}

export interface DrawnSelection {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function drawnIn(selection: Selection, wrapper: Box): DrawnSelection {
  const across = selection.unit === '%' ? wrapper.width / 100 : 1;
  const down = selection.unit === '%' ? wrapper.height / 100 : 1;
  return {
    x: selection.x * across,
    y: selection.y * down,
    width: selection.width * across,
    height: selection.height * down,
  };
}

/** 1 is a circle. Anything else is the oval. */
export function ovalness(selection: Selection, wrapper: Box): number {
  const drawn = drawnIn(selection, wrapper);
  return drawn.height === 0 ? 0 : drawn.width / drawn.height;
}

/**
 * The opening selection: a true circle, because its two edges come out the same number of
 * wrapper pixels, and centred on the photo rather than on the wrapper the photo sits in.
 */
export function openingSelection(placement: Placement, fill = 0.8): Selection {
  const { wrapper, rendered, offsetX, offsetY } = placement;
  const side = Math.min(rendered.width, rendered.height) * fill;
  return {
    unit: '%',
    x: ((offsetX + (rendered.width - side) / 2) / wrapper.width) * 100,
    y: ((offsetY + (rendered.height - side) / 2) / wrapper.height) * 100,
    width: (side / wrapper.width) * 100,
    height: (side / wrapper.height) * 100,
  };
}

/** The selection carried through the wrapper, off the rendered photo, onto the photo's own pixels. */
export function sourceSquare(selection: Selection, placement: Placement): SourceSquare | null {
  const { rendered, natural } = placement;
  if (natural.width <= 0 || natural.height <= 0 || rendered.width <= 0 || rendered.height <= 0) {
    return null;
  }

  const drawn = drawnIn(selection, placement.wrapper);
  const across = natural.width / rendered.width;
  const down = natural.height / rendered.height;

  const side = Math.round(Math.min(drawn.width * across, drawn.height * down));
  if (side <= 0) return null;

  return {
    x: Math.round(clamp((drawn.x - placement.offsetX) * across, 0, natural.width - side)),
    y: Math.round(clamp((drawn.y - placement.offsetY) * down, 0, natural.height - side)),
    side,
  };
}

export function placementOf(photo: HTMLImageElement, wrapper: Element): Placement {
  const painted = photo.getBoundingClientRect();
  const around = wrapper.getBoundingClientRect();
  return {
    wrapper: { width: around.width, height: around.height },
    rendered: { width: painted.width, height: painted.height },
    offsetX: painted.left - around.left,
    offsetY: painted.top - around.top,
    natural: { width: photo.naturalWidth, height: photo.naturalHeight },
  };
}

export const UPLOAD_MEDIA_TYPE = 'image/webp';

const UPLOAD_QUALITY = 0.9;

export const MAX_UPLOAD_PIXELS = 1024;

export async function squareBlob(photo: CanvasImageSource, square: SourceSquare): Promise<Blob> {
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
