import { Tooltip, TooltipContent, TooltipTrigger } from '@sync/ui/components/ui/tooltip';
import { cn } from '@sync/ui/lib/utils';
import { useEffect, useRef, useState } from 'react';

interface TruncatedTextProps {
  children: string;
  className?: string;
}

/** A clipped value has to be readable without a mouse, so it takes a focus stop of its own — but
 * only when nothing around it already has one, because a row opener is a link or a button and
 * neither may hold another focusable element. */
export function TruncatedText({ children, className }: TruncatedTextProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [hidden, setHidden] = useState<string | null>(null);
  const [ownFocus, setOwnFocus] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const measure = () => {
      setHidden(node.scrollWidth > node.clientWidth ? children : null);
      setOwnFocus(node.closest('a, button') === null);
    };
    measure();

    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [children]);

  return (
    <Tooltip disabled={hidden === null}>
      <TooltipTrigger
        render={
          <span
            ref={ref}
            tabIndex={hidden !== null && ownFocus ? 0 : undefined}
            className={cn('block truncate', className)}
          >
            {children}
          </span>
        }
      />
      <TooltipContent>{hidden}</TooltipContent>
    </Tooltip>
  );
}
