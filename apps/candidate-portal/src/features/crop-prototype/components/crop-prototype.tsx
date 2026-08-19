/**
 * PROTOTYPE — issue #368. Throwaway. Nothing here is meant to ship.
 *
 * The question: is the overlay opening as an oval the same fault as the saved photo not being
 * centred on what was selected, or are they two? And whichever it is, does react-image-crop
 * survive the remedy?
 *
 * The page answers it by showing, for one photo at a time, the overlay at first paint beside
 * the square that would be saved from it, under three candidate remedies:
 *
 *   A  today's code, verbatim
 *   B  react-image-crop kept, the geometry corrected
 *   C  no library at all — a fixed round viewport the photo pans behind
 *
 * Switch with the bar at the bottom, or the arrow keys. The reading below the panes is the
 * whole of the state.
 */
import { Button } from '@sync/ui/components/ui/button';
import { Card, CardContent } from '@sync/ui/components/ui/card';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import 'react-image-crop/dist/ReactCrop.css';
import {
  MAX_UPLOAD_PIXELS,
  type Placement,
  type SourceSquare,
  sourceSquare,
  squareBlob,
} from '../geometry';
import { firstTestImage, testImages } from '../test-images';
import type { Reading, Variant } from '../variant';
import { PrototypeSwitcher } from './prototype-switcher';
import { VariantAToday } from './variant-a-today';
import { VariantBFixed } from './variant-b-fixed';
import { VariantCViewport } from './variant-c-viewport';

const TODAY: Variant = {
  key: 'A',
  name: "Today's code",
  question: 'What ships now. Expected to reproduce both faults on a tall photo.',
  Component: VariantAToday,
};

const FIXED: Variant = {
  key: 'B',
  name: 'Library kept, geometry fixed',
  question: 'react-image-crop stays. Only the two conversions either side of it change.',
  Component: VariantBFixed,
};

const ROUND: Variant = {
  key: 'C',
  name: 'No library, round viewport',
  question: 'The circle is the viewport. Nothing can be an oval, and nothing can drift.',
  Component: VariantCViewport,
};

export const VARIANTS: Variant[] = [TODAY, FIXED, ROUND];

interface CropPrototypeProps {
  variant: string;
  onVariant: (key: string) => void;
}

export function CropPrototype({ variant, onVariant }: CropPrototypeProps) {
  const images = testImages();
  const [picked, setPicked] = useState(() => firstTestImage().src);
  const [pickedLabel, setPickedLabel] = useState(() => firstTestImage().label);
  const [reading, setReading] = useState<Reading | null>(null);
  const [firstPaint, setFirstPaint] = useState<Reading | null>(null);
  const pinned = useRef<string | null>(null);
  const uploadId = useId();

  const current = VARIANTS.find((entry) => entry.key === variant) ?? TODAY;
  const key = `${current.key}:${picked.slice(0, 64)}`;
  const keyRef = useRef(key);
  keyRef.current = key;

  const onReading = useCallback((next: Reading) => {
    setReading(next);
    if (pinned.current !== keyRef.current) {
      pinned.current = keyRef.current;
      setFirstPaint(next);
    }
  }, []);

  const live = useCutOut(reading);
  const opening = useCutOut(firstPaint);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6 pb-28">
      <header className="space-y-2">
        <p className="font-mono text-meta text-muted-foreground">PROTOTYPE — issue #368</p>
        <h1 className="font-heading text-h2">The avatar crop: one fault or two?</h1>
        <p className="max-w-3xl text-muted-foreground">
          The overlay at first paint, beside the square that would be saved from it. Pick a shape of
          photo, then switch remedies with the bar at the foot of the page.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        {images.map((image) => (
          <Button
            key={image.key}
            type="button"
            size="sm"
            variant={picked === image.src ? 'default' : 'outline'}
            onClick={() => {
              setPicked(image.src);
              setPickedLabel(image.label);
            }}
          >
            {image.label}
          </Button>
        ))}
        <label
          htmlFor={uploadId}
          className="cursor-pointer rounded-md border px-3 py-1.5 text-dense hover:bg-accent"
        >
          Your own photo…
        </label>
        <input
          id={uploadId}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            setPicked(URL.createObjectURL(file));
            setPickedLabel(file.name);
          }}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="space-y-2">
          <h2 className="font-heading text-h3">
            The overlay{' '}
            <span className="text-muted-foreground text-meta">— as the reader sees it</span>
          </h2>
          <p className="text-meta text-muted-foreground">
            The box below carries what <code>DialogContent</code> puts on the real cropper:{' '}
            <code>sm:max-w-md</code> and <code>p-4</code>.
          </p>
          <div className="grid w-full max-w-md gap-4 rounded-xl bg-popover p-4 text-popover-foreground ring-1 ring-foreground/10">
            <current.Component key={key} src={picked} onReading={onReading} />
          </div>
        </section>

        <section className="space-y-4">
          <div className="space-y-2">
            <h2 className="font-heading text-h3">
              At first paint{' '}
              <span className="text-muted-foreground text-meta">— nothing touched yet</span>
            </h2>
            <Cutout reading={firstPaint} output={opening} />
          </div>
          <div className="space-y-2">
            <h2 className="font-heading text-h3">
              Live <span className="text-muted-foreground text-meta">— after your dragging</span>
            </h2>
            <Cutout reading={reading} output={live} />
          </div>
        </section>
      </div>

      <Verdict reading={reading} firstPaint={firstPaint} photo={pickedLabel} variant={current} />

      <PrototypeSwitcher variants={VARIANTS} current={current} onPick={onVariant} />
    </div>
  );
}

function Cutout({ reading, output }: { reading: Reading | null; output: string | null }) {
  if (!reading || !output) {
    return <p className="text-meta text-muted-foreground">Waiting for the photo…</p>;
  }
  const side = reading.square ? Math.min(reading.square.side, MAX_UPLOAD_PIXELS) : 0;

  return (
    <div className="flex items-center gap-5">
      <figure className="space-y-1">
        <img
          src={output}
          alt="The square that would be uploaded"
          className="rounded-md ring-1 ring-foreground/10"
          style={{ width: 176, height: 176 }}
        />
        <figcaption className="text-meta text-muted-foreground">
          Saved square — {side} × {side}
        </figcaption>
      </figure>
      <figure className="space-y-1">
        <img
          src={output}
          alt="The same square, worn as an avatar"
          className="rounded-full ring-1 ring-foreground/10"
          style={{ width: 96, height: 96 }}
        />
        <figcaption className="text-meta text-muted-foreground">Worn as an avatar</figcaption>
      </figure>
    </div>
  );
}

function Verdict({
  reading,
  firstPaint,
  photo,
  variant,
}: {
  reading: Reading | null;
  firstPaint: Reading | null;
  photo: string;
  variant: Variant;
}) {
  if (!reading || !firstPaint) return null;

  const { placement } = reading;
  const acrossGap = Math.round(placement.wrapper.width - placement.rendered.width);
  const downGap = Math.round(placement.wrapper.height - placement.rendered.height);
  const meant = sourceSquare(reading.selection, placement);
  const drift = driftBetween(reading.square, meant);

  return (
    <Card>
      <CardContent className="grid gap-6 py-5 md:grid-cols-2">
        <div className="space-y-1 font-mono text-dense">
          <Line label="photo" value={photo} />
          <Line label="variant" value={`${variant.key} — ${variant.name}`} />
          <Line label="natural" value={box(placement.natural)} />
          <Line label="wrapper (%s measured here)" value={box(placement.wrapper)} />
          <Line label="rendered photo" value={box(placement.rendered)} />
          <Line
            label="photo offset in wrapper"
            value={`${Math.round(placement.offsetX)}, ${Math.round(placement.offsetY)}`}
          />
          <Line label="selection" value={selectionOf(reading)} />
          <Line label="saved square" value={squareOf(reading.square)} />
        </div>

        <div className="space-y-3">
          <Finding
            good={acrossGap === 0 && downGap === 0}
            bad={`The wrapper is ${acrossGap} px wider and ${downGap} px taller than the photo inside it. Every percentage is measured against the wrapper, so any sum that treats them as the photo's own is off by that much.`}
            fine="The wrapper and the photo are the same box, so a percentage of one is a percentage of the other."
          />
          <Finding
            good={Math.abs(firstPaint.ovalness - 1) < 0.01}
            bad={`At first paint the overlay is ${firstPaint.ovalness.toFixed(3)} times as wide as it is tall — an oval. It rounds up to a circle on the first drag, because the drag re-derives the percentages from the wrapper.`}
            fine="At first paint the overlay is already a circle."
          />
          <Finding
            good={drift < 1}
            bad={`The saved square sits ${drift} px away from the middle of what is inside the circle. Dragging does not cure it: the conversion back keeps reading wrapper percentages as though they were the photo's.`}
            fine="The saved square is centred on what is inside the circle."
          />
        </div>
      </CardContent>
    </Card>
  );
}

function Finding({ good, bad, fine }: { good: boolean; bad: string; fine: string }) {
  return (
    <p className={good ? 'text-dense' : 'text-dense text-destructive'}>
      <b>{good ? 'PASS' : 'FAIL'}</b> — {good ? fine : bad}
    </p>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <p className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </p>
  );
}

function box(shape: { width: number; height: number }): string {
  return `${Math.round(shape.width)} × ${Math.round(shape.height)}`;
}

function squareOf(square: SourceSquare | null): string {
  return square ? `${square.side} at ${square.x}, ${square.y}` : 'none';
}

function selectionOf(reading: Reading): string {
  const { unit, x, y, width, height } = reading.selection;
  const round = (value: number) => (unit === '%' ? value.toFixed(1) : Math.round(value));
  return `${round(width)} × ${round(height)}${unit} at ${round(x)}, ${round(y)}`;
}

function driftBetween(saved: SourceSquare | null, meant: SourceSquare | null): number {
  if (!saved || !meant) return 0;
  const acrossGap = saved.x + saved.side / 2 - (meant.x + meant.side / 2);
  const downGap = saved.y + saved.side / 2 - (meant.y + meant.side / 2);
  return Math.round(Math.hypot(acrossGap, downGap));
}

function useCutOut(reading: Reading | null): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!reading?.square) return;
    let stale = false;
    let made: string | null = null;

    void squareBlob(reading.photo, reading.square).then((blob) => {
      if (stale) return;
      made = URL.createObjectURL(blob);
      setUrl(made);
    });

    return () => {
      stale = true;
      if (made) URL.revokeObjectURL(made);
    };
  }, [reading]);

  return url;
}

export type { Placement };
