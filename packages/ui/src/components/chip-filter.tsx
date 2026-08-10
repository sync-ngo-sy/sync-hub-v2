import { Radio } from '@base-ui/react/radio';
import { RadioGroup } from '@base-ui/react/radio-group';

import { cn } from '@sync/ui/lib/utils';

export interface FilterChip {
  value: string;
  label: string;
  count?: number;
}

interface ChipFilterProps {
  label: string;
  value: string;
  chips: readonly FilterChip[];
  onValueChange: (value: string) => void;
  className?: string;
}

export function ChipFilter({ label, value, chips, onValueChange, className }: ChipFilterProps) {
  return (
    <RadioGroup
      aria-label={label}
      value={value}
      onValueChange={(chosen) => onValueChange(chosen as string)}
      className={cn('flex min-w-0 flex-wrap items-center gap-2', className)}
    >
      {chips.map((chip) => (
        <Radio.Root
          key={chip.value}
          value={chip.value}
          aria-label={chip.count === undefined ? chip.label : `${chip.label} ${chip.count}`}
          className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-4xl px-3 text-dense whitespace-nowrap text-muted-foreground ring-1 ring-border ring-inset outline-none transition-colors select-none hover:bg-interactive-hover hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 data-checked:bg-primary data-checked:text-primary-foreground data-checked:ring-transparent data-checked:hover:bg-primary data-checked:hover:text-primary-foreground"
        >
          {chip.label}
          {chip.count !== undefined ? (
            <span className="text-meta font-mono tabular-nums opacity-70">{chip.count}</span>
          ) : null}
        </Radio.Root>
      ))}
    </RadioGroup>
  );
}
