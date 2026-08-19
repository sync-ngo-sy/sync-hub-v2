/**
 * VARIANT B — react-image-crop kept, the geometry corrected.
 *
 * Three changes against Variant A, and nothing else:
 *   1. the opening circle is measured on the wrapper and centred on the photo, not derived
 *      from the photo's own pixels;
 *   2. the saved square goes through `sourceSquare`, which takes the photo's offset and scale
 *      inside the wrapper into account;
 *   3. "Hug the photo" narrows the wrapper onto the photo, which is a separate, optional cure
 *      for the dead margin the circle can otherwise be dragged into. Leave it off to see that
 *      the geometry fix alone already centres the save.
 */
import { Label } from '@sync/ui/components/ui/label';
import { Switch } from '@sync/ui/components/ui/switch';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import ReactCrop from 'react-image-crop';
import { openingSelection, ovalness, placementOf, type Selection, sourceSquare } from '../geometry';
import type { VariantProps } from '../variant';

export function VariantBFixed({ src, onReading }: VariantProps) {
  const [crop, setCrop] = useState<Selection | null>(null);
  const [hug, setHug] = useState(false);
  const [hugWidth, setHugWidth] = useState<number | null>(null);
  const photo = useRef<HTMLImageElement>(null);
  const around = useRef<HTMLDivElement>(null);
  const hugId = useId();

  const measure = useCallback(() => {
    const image = photo.current;
    const wrapper = around.current?.querySelector('.ReactCrop');
    if (!image || !wrapper || !image.naturalWidth) return;
    return placementOf(image, wrapper);
  }, []);

  const reopen = useCallback(() => {
    requestAnimationFrame(() => {
      const placement = measure();
      if (placement) setCrop(openingSelection(placement));
    });
  }, [measure]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: a new photo drops the old framing
  useEffect(() => {
    setCrop(null);
    setHugWidth(null);
  }, [src]);

  useEffect(() => {
    if (!hug) {
      setHugWidth(null);
      reopen();
      return;
    }
    const placement = measure();
    if (placement) setHugWidth(placement.rendered.width);
    reopen();
  }, [hug, measure, reopen]);

  useEffect(() => {
    window.addEventListener('resize', reopen);
    return () => window.removeEventListener('resize', reopen);
  }, [reopen]);

  useEffect(() => {
    const image = photo.current;
    const placement = measure();
    if (!image || !placement || !crop) return;

    onReading({
      placement,
      selection: crop,
      square: sourceSquare(crop, placement),
      ovalness: ovalness(crop, placement.wrapper),
      photo: image,
    });
  }, [crop, measure, onReading]);

  return (
    <div className="space-y-3">
      <div ref={around}>
        <ReactCrop
          crop={crop ?? undefined}
          onChange={(_, percent) => setCrop(percent)}
          aspect={1}
          circularCrop
          keepSelection
          minWidth={32}
          style={{ maxHeight: '50vh', width: hugWidth ? `${hugWidth}px` : undefined }}
        >
          <img
            ref={photo}
            src={src}
            alt="The one you picked, ready to be framed"
            onLoad={reopen}
            className="max-w-full"
            style={{ maxHeight: '50vh' }}
          />
        </ReactCrop>
      </div>

      <div className="flex items-center gap-2">
        <Switch id={hugId} checked={hug} onCheckedChange={setHug} />
        <Label htmlFor={hugId} className="text-meta text-muted-foreground">
          Hug the photo — cure 3, the dead margin
        </Label>
      </div>
    </div>
  );
}
