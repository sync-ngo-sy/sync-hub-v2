// PROTOTYPE for #369 — throwaway. The bar that flips between variants and drives the scenarios,
// and prints the update state so what happened is never a guess.

import { Button } from '@sync/ui/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect } from 'react';
import type { UpdateState } from './update-stub';

interface PrototypeSwitcherProps {
  variants: string[];
  current: string;
  name: string;
  chosen: boolean;
  onSelect: (variant: string) => void;
  state: UpdateState;
  onUpload: () => void;
  onNotification: () => void;
  onScenario: (firstUpload: boolean) => void;
}

function typing(): boolean {
  const active = document.activeElement;
  if (!(active instanceof HTMLElement)) return false;
  return (
    active instanceof HTMLInputElement ||
    active instanceof HTMLTextAreaElement ||
    active.isContentEditable ||
    active.closest('[role="dialog"], [role="alertdialog"]') !== null
  );
}

export function PrototypeSwitcher({
  variants,
  current,
  name,
  chosen,
  onSelect,
  state,
  onUpload,
  onNotification,
  onScenario,
}: PrototypeSwitcherProps) {
  const at = Math.max(variants.indexOf(current), 0);
  const step = (by: number) =>
    onSelect(variants[(at + by + variants.length) % variants.length] ?? current);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      if (typing()) return;
      step(event.key === 'ArrowLeft' ? -1 : 1);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (import.meta.env.PROD) return null;

  const ghost = 'text-white hover:bg-white/15 hover:text-white';
  const readout = [
    `phase=${state.phase}`,
    `asking=${state.asking}`,
    `answer=${state.answer ?? '—'}`,
    `remembered=${state.remembered ?? '—'}`,
    `updated=${state.updatedBy ?? '—'}`,
    `first=${state.firstUpload}`,
  ].join('  ');

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-3 z-50 flex justify-center px-3">
      <div className="pointer-events-auto max-w-full space-y-2 rounded-2xl border-2 border-yellow-400 bg-zinc-950 px-3 py-2 text-white shadow-2xl">
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label="Previous variant"
            className={ghost}
            onClick={() => step(-1)}
          >
            <ChevronLeft aria-hidden="true" />
          </Button>
          <p className="min-w-40 text-center text-sm font-medium">
            {current} — {name}
            {chosen ? <span className="ml-2 text-yellow-400">chosen</span> : null}
          </p>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label="Next variant"
            className={ghost}
            onClick={() => step(1)}
          >
            <ChevronRight aria-hidden="true" />
          </Button>

          <span className="mx-1 h-5 w-px bg-white/25" />

          <Button
            type="button"
            size="sm"
            className="bg-yellow-400 text-black hover:bg-yellow-300"
            onClick={onUpload}
          >
            Simulate an upload
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className={ghost}
            onClick={onNotification}
          >
            Simulate the notification link
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className={ghost}
            onClick={() => onScenario(true)}
          >
            Empty profile
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className={ghost}
            onClick={() => onScenario(false)}
          >
            Reset
          </Button>
        </div>

        <p className="text-center font-mono text-[11px] leading-4 text-white/60">{readout}</p>
      </div>
    </div>
  );
}
