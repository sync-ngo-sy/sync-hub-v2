/**
 * VARIANT C — no cropping library. The circle never moves: it is a fixed round viewport, and
 * the photo pans and zooms behind it. Drag to move, wheel or the slider to zoom.
 *
 * The selection cannot come out an oval, because there is no selection — the viewport is the
 * output. It reports through the same `sourceSquare` Variant B uses, unchanged, which is the
 * evidence that the seam is a pure function over a placement and not a cropper-shaped hook.
 */
import { Label } from '@sync/ui/components/ui/label';
import { type PointerEvent as ReactPointerEvent, useEffect, useId, useRef, useState } from 'react';
import { ovalness, type Placement, type Selection, sourceSquare } from '../geometry';
import type { VariantProps } from '../variant';

const VIEWPORT = 288;

const MOST_ZOOM = 8;

const SELECTION: Selection = { unit: 'px', x: 0, y: 0, width: VIEWPORT, height: VIEWPORT };

export function VariantCViewport({ src, onReading }: VariantProps) {
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [centre, setCentre] = useState({ x: 0, y: 0 });
  const photo = useRef<HTMLImageElement>(null);
  const dragging = useRef<{ x: number; y: number } | null>(null);
  const zoomId = useId();

  // biome-ignore lint/correctness/useExhaustiveDependencies: a new photo drops the old framing
  useEffect(() => {
    setNatural(null);
    setZoom(1);
  }, [src]);

  const floor = natural ? VIEWPORT / Math.min(natural.width, natural.height) : 1;
  const scale = floor * zoom;
  const side = VIEWPORT / scale;

  function hold(event: ReactPointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragging.current = { x: event.clientX, y: event.clientY };
  }

  function move(event: ReactPointerEvent<HTMLDivElement>) {
    const from = dragging.current;
    if (!from || !natural) return;
    dragging.current = { x: event.clientX, y: event.clientY };
    setCentre((was) =>
      hemmedIn(
        {
          x: was.x - (event.clientX - from.x) / scale,
          y: was.y - (event.clientY - from.y) / scale,
        },
        natural,
        side,
      ),
    );
  }

  function release(event: ReactPointerEvent<HTMLDivElement>) {
    event.currentTarget.releasePointerCapture(event.pointerId);
    dragging.current = null;
  }

  useEffect(() => {
    const image = photo.current;
    if (!image || !natural) return;

    const offsetX = VIEWPORT / 2 - centre.x * scale;
    const offsetY = VIEWPORT / 2 - centre.y * scale;
    const placement: Placement = {
      wrapper: { width: VIEWPORT, height: VIEWPORT },
      rendered: { width: natural.width * scale, height: natural.height * scale },
      offsetX,
      offsetY,
      natural,
    };

    onReading({
      placement,
      selection: SELECTION,
      square: sourceSquare(SELECTION, placement),
      ovalness: ovalness(SELECTION, placement.wrapper),
      photo: image,
    });
  }, [centre, natural, onReading, scale]);

  return (
    <div className="space-y-3">
      <div
        className="relative overflow-hidden rounded-full bg-muted touch-none select-none"
        style={{ width: VIEWPORT, height: VIEWPORT, cursor: 'grab' }}
        onPointerDown={hold}
        onPointerMove={move}
        onPointerUp={release}
        onPointerCancel={release}
        onWheel={(event) => {
          if (!natural) return;
          const next = Math.min(MOST_ZOOM, Math.max(1, zoom * (event.deltaY < 0 ? 1.1 : 1 / 1.1)));
          setZoom(next);
          setCentre((was) => hemmedIn(was, natural, VIEWPORT / (floor * next)));
        }}
      >
        <img
          ref={photo}
          src={src}
          alt="The one you picked, ready to be framed"
          draggable={false}
          onLoad={(event) => {
            const { naturalWidth, naturalHeight } = event.currentTarget;
            setNatural({ width: naturalWidth, height: naturalHeight });
            setCentre({ x: naturalWidth / 2, y: naturalHeight / 2 });
          }}
          style={{
            position: 'absolute',
            width: natural ? natural.width * scale : undefined,
            height: natural ? natural.height * scale : undefined,
            left: VIEWPORT / 2 - centre.x * scale,
            top: VIEWPORT / 2 - centre.y * scale,
            maxWidth: 'none',
          }}
        />
      </div>

      <div className="flex items-center gap-3">
        <Label htmlFor={zoomId} className="text-meta text-muted-foreground">
          Zoom
        </Label>
        <input
          id={zoomId}
          type="range"
          min={1}
          max={MOST_ZOOM}
          step={0.01}
          value={zoom}
          disabled={!natural}
          className="w-48"
          onChange={(event) => {
            const next = Number(event.target.value);
            setZoom(next);
            if (natural) setCentre((was) => hemmedIn(was, natural, VIEWPORT / (floor * next)));
          }}
        />
        <span className="font-mono text-meta text-muted-foreground">{zoom.toFixed(2)}×</span>
      </div>
    </div>
  );
}

function hemmedIn(
  centre: { x: number; y: number },
  natural: { width: number; height: number },
  side: number,
) {
  const half = side / 2;
  return {
    x: Math.min(Math.max(centre.x, half), natural.width - half),
    y: Math.min(Math.max(centre.y, half), natural.height - half),
  };
}
