import { Button } from '@sync/ui/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect } from 'react';
import type { Variant } from '../variant';

interface PrototypeSwitcherProps {
  variants: Variant[];
  current: Variant;
  onPick: (key: string) => void;
}

export function PrototypeSwitcher({ variants, current, onPick }: PrototypeSwitcherProps) {
  function step(by: number) {
    const at = variants.findIndex((variant) => variant.key === current.key);
    const next = variants[(at + by + variants.length) % variants.length];
    if (next) onPick(next.key);
  }

  useEffect(() => {
    function cycle(event: KeyboardEvent) {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      const focused = document.activeElement;
      if (
        focused instanceof HTMLInputElement ||
        focused instanceof HTMLTextAreaElement ||
        (focused instanceof HTMLElement && focused.isContentEditable)
      ) {
        return;
      }
      step(event.key === 'ArrowLeft' ? -1 : 1);
    }
    window.addEventListener('keydown', cycle);
    return () => window.removeEventListener('keydown', cycle);
  });

  if (!import.meta.env.DEV) return null;

  return (
    <div className="-translate-x-1/2 fixed bottom-5 left-1/2 z-50 flex items-center gap-1 rounded-full border-2 border-foreground bg-background p-1 shadow-lg">
      <Button type="button" variant="ghost" size="icon" onClick={() => step(-1)}>
        <ChevronLeft aria-hidden="true" />
        <span className="sr-only">Previous variant</span>
      </Button>
      <span className="px-2 font-mono text-dense">
        <b>{current.key}</b> — {current.name}
      </span>
      <Button type="button" variant="ghost" size="icon" onClick={() => step(1)}>
        <ChevronRight aria-hidden="true" />
        <span className="sr-only">Next variant</span>
      </Button>
    </div>
  );
}
