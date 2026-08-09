import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@sync/ui/components/ui/dropdown-menu';
import { ChevronDown } from 'lucide-react';

interface ChecklistOption<TValue extends string> {
  value: TValue;
  label: string;
}

interface ChecklistFilterProps<TValue extends string> {
  label: string;
  noun: string;
  options: ChecklistOption<TValue>[];
  selected: TValue[];
  counts: Partial<Record<TValue, number>>;
  onChange: (selected: TValue[]) => void;
}

function theOnlyOne<TItem>(items: TItem[]): TItem | undefined {
  const [first, ...rest] = items;
  return rest.length === 0 ? first : undefined;
}

function summarize<TValue extends string>(
  options: ChecklistOption<TValue>[],
  selected: TValue[],
  noun: string,
): string {
  if (selected.length === options.length) return `All ${noun}`;
  const only = theOnlyOne(options.filter((option) => selected.includes(option.value)));
  return only ? only.label : `${selected.length} ${noun}`;
}

export function ChecklistFilter<TValue extends string>({
  label,
  noun,
  options,
  selected,
  counts,
  onChange,
}: ChecklistFilterProps<TValue>) {
  const only = theOnlyOne(selected);

  return (
    <div className="flex min-w-0 items-center gap-3">
      <span aria-hidden="true" className="shrink-0 text-meta text-muted-foreground">
        {label}
      </span>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={`${label}: ${summarize(options, selected, noun)}`}
          className="inline-flex h-9 items-center justify-between gap-1.5 rounded-lg border border-input bg-input-background py-2 pr-2.5 pl-3 text-sm font-normal whitespace-nowrap outline-none transition-colors select-none hover:text-inherit focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
        >
          {summarize(options, selected, noun)}
          <ChevronDown className="size-4 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuItem onClick={() => onChange(options.map((option) => option.value))}>
            {`All ${noun}`}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {options.map((option) => (
            <DropdownMenuCheckboxItem
              key={option.value}
              className="pr-10"
              aria-label={`${option.label}, ${counts[option.value] ?? 0}`}
              checked={selected.includes(option.value)}
              disabled={only === option.value}
              onCheckedChange={(checked) =>
                onChange(
                  options
                    .filter((one) =>
                      one.value === option.value ? checked : selected.includes(one.value),
                    )
                    .map((one) => one.value),
                )
              }
            >
              <span className="flex-1">{option.label}</span>
              <span className="text-meta tabular-nums text-muted-foreground">
                {counts[option.value] ?? 0}
              </span>
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
