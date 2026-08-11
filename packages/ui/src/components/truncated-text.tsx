import { Tooltip, TooltipContent, TooltipTrigger } from '@sync/ui/components/ui/tooltip';
import { cn } from '@sync/ui/lib/utils';
import { useEffect, useRef, useState } from 'react';

interface TruncatedTextProps {
  children: string;
  className?: string;
}

export function TruncatedText({ children, className }: TruncatedTextProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [hidden, setHidden] = useState<string | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const measure = () => setHidden(node.scrollWidth > node.clientWidth ? children : null);
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
          <span ref={ref} className={cn('block truncate', className)}>
            {children}
          </span>
        }
      />
      <TooltipContent>{hidden}</TooltipContent>
    </Tooltip>
  );
}
