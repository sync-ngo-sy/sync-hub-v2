import { cn } from '@sync/ui/lib/utils';

interface SegmentedFilterProps<TValue extends string> {
  label: string;
  anyLabel: string;
  value: TValue | undefined;
  options: { value: TValue; label: string }[];
  onChange: (value: TValue | undefined) => void;
}

export function SegmentedFilter<TValue extends string>({
  label,
  anyLabel,
  value,
  options,
  onChange,
}: SegmentedFilterProps<TValue>) {
  const segments: { key: string; label: string; picked: boolean; pick: () => void }[] = [
    { key: 'any', label: anyLabel, picked: value === undefined, pick: () => onChange(undefined) },
    ...options.map((option) => ({
      key: option.value,
      label: option.label,
      picked: value === option.value,
      pick: () => onChange(option.value),
    })),
  ];

  return (
    <div className="flex min-w-0 max-w-full items-center gap-3">
      <span aria-hidden="true" className="shrink-0 text-meta text-muted-foreground">
        {label}
      </span>
      <div className="min-w-0 overflow-x-auto">
        <fieldset className="inline-flex h-8 w-fit items-center rounded-lg bg-muted p-[3px]">
          <legend className="sr-only">{label}</legend>
          {segments.map((segment) => (
            <button
              key={segment.key}
              type="button"
              aria-pressed={segment.picked}
              onClick={segment.pick}
              className={cn(
                'inline-flex h-full items-center rounded-md px-2 text-sm font-medium whitespace-nowrap outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50',
                segment.picked
                  ? 'bg-background text-foreground shadow-sm dark:bg-input/30'
                  : 'text-foreground/60 hover:text-foreground dark:text-muted-foreground dark:hover:text-foreground',
              )}
            >
              {segment.label}
            </button>
          ))}
        </fieldset>
      </div>
    </div>
  );
}
