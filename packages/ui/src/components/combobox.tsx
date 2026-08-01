import { Combobox as ComboboxPrimitive } from '@base-ui/react/combobox';
import { cn } from '@sync/ui/lib/utils';
import { CheckIcon, ChevronDownIcon, XIcon } from 'lucide-react';

export interface ComboboxOption {
  value: string;
  label: string;
}

export interface ComboboxOptionGroup {
  label: string;
  options: ComboboxOption[];
}

interface ComboboxBaseProps {
  options: ComboboxOption[] | ComboboxOptionGroup[];
  placeholder?: string;
  /** One sentence, shown in place of the list when the query matches nothing. */
  emptyMessage?: string;
  /** While true the panel says the list is still arriving, never that it is empty. */
  loading?: boolean;
  loadingMessage?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
  'aria-label'?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
}

interface SingleComboboxProps extends ComboboxBaseProps {
  multiple?: false;
  value?: string | null;
  defaultValue?: string | null;
  onValueChange?: (value: string | null) => void;
}

interface MultipleComboboxProps extends ComboboxBaseProps {
  multiple: true;
  value?: string[];
  defaultValue?: string[];
  onValueChange?: (value: string[]) => void;
}

export type ComboboxProps = SingleComboboxProps | MultipleComboboxProps;

type Selection = ComboboxOption | ComboboxOption[] | null;

/** The primitive names a group by `value` and nests its options under `items`. */
interface PrimitiveGroup {
  value: string;
  items: ComboboxOption[];
}

function isGrouped(
  options: ComboboxOption[] | ComboboxOptionGroup[],
): options is ComboboxOptionGroup[] {
  const first = options[0];
  return first !== undefined && 'options' in first;
}

/** A value the options don't cover keeps its place in the selection rather than vanishing —
 * the list may still be arriving — and wears the value itself until its label turns up. */
function optionFor(options: ComboboxOption[], value: string): ComboboxOption {
  return options.find((option) => option.value === value) ?? { value, label: value };
}

/** The primitive selects whole option objects; consumers only ever handle the values. */
function toSelection(
  options: ComboboxOption[],
  value: string | string[] | null | undefined,
): Selection | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (Array.isArray(value)) {
    return value.map((each) => optionFor(options, each));
  }
  return value === null ? null : optionFor(options, value);
}

const MESSAGE_SURFACE = 'px-1.5 py-2 text-sm text-muted-foreground';

const FIELD_SURFACE =
  'flex w-full items-center gap-1 rounded-lg border border-input bg-transparent py-1 pr-1 pl-2.5 text-sm transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 has-aria-invalid:border-destructive has-aria-invalid:ring-3 has-aria-invalid:ring-destructive/20 has-disabled:cursor-not-allowed has-disabled:opacity-50 dark:bg-input/30 dark:has-aria-invalid:border-destructive/50 dark:has-aria-invalid:ring-destructive/40';

export function Combobox(props: ComboboxProps) {
  const {
    options,
    placeholder,
    emptyMessage = 'No matches.',
    loading = false,
    loadingMessage = 'Loading…',
    disabled,
    id,
    className,
  } = props;

  const grouped = isGrouped(options);
  const selectable = grouped ? options.flatMap((group) => group.options) : options;
  const items: ComboboxOption[] | PrimitiveGroup[] = grouped
    ? options.map((group) => ({ value: group.label, items: group.options }))
    : options;

  const renderOption = (option: ComboboxOption) => (
    <ComboboxPrimitive.Item
      key={option.value}
      value={option}
      className="relative flex cursor-default items-center rounded-md py-1 pr-8 pl-1.5 text-sm outline-hidden select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground"
    >
      {option.label}
      <ComboboxPrimitive.ItemIndicator
        render={
          <span className="pointer-events-none absolute right-2 flex size-4 items-center justify-center" />
        }
      >
        <CheckIcon aria-hidden="true" className="size-4" />
      </ComboboxPrimitive.ItemIndicator>
    </ComboboxPrimitive.Item>
  );

  const input = (
    <ComboboxPrimitive.Input
      id={id}
      disabled={disabled}
      placeholder={placeholder}
      aria-label={props['aria-label']}
      aria-describedby={props['aria-describedby']}
      aria-invalid={props['aria-invalid']}
      className="h-6 min-w-24 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
    />
  );

  return (
    <ComboboxPrimitive.Root
      items={items}
      multiple={props.multiple}
      disabled={disabled}
      value={toSelection(selectable, props.value)}
      defaultValue={toSelection(selectable, props.defaultValue)}
      onValueChange={(selection: Selection) => {
        const chosen = Array.isArray(selection) ? selection : selection ? [selection] : [];
        if (props.multiple) {
          props.onValueChange?.(chosen.map((option) => option.value));
        } else {
          props.onValueChange?.(chosen[0]?.value ?? null);
        }
      }}
    >
      <ComboboxPrimitive.InputGroup className={cn(FIELD_SURFACE, className)}>
        {props.multiple ? (
          <ComboboxPrimitive.Chips className="flex flex-1 flex-wrap items-center gap-1 py-0.5">
            <ComboboxPrimitive.Value>
              {(selected: ComboboxOption[]) => (
                <>
                  {selected.map((option) => (
                    <ComboboxPrimitive.Chip
                      key={option.value}
                      className="flex items-center gap-1 rounded-md bg-muted py-0.5 pr-1 pl-2 text-dense text-muted-foreground"
                    >
                      {option.label}
                      <ComboboxPrimitive.ChipRemove
                        aria-label={`Remove ${option.label}`}
                        className="rounded-sm p-0.5 outline-none hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
                      >
                        <XIcon aria-hidden="true" className="size-3" />
                      </ComboboxPrimitive.ChipRemove>
                    </ComboboxPrimitive.Chip>
                  ))}
                  {input}
                </>
              )}
            </ComboboxPrimitive.Value>
          </ComboboxPrimitive.Chips>
        ) : (
          input
        )}
        <ComboboxPrimitive.Trigger
          disabled={disabled}
          aria-label="Show options"
          className="flex size-6 shrink-0 items-center justify-center self-start rounded-md text-muted-foreground outline-none hover:text-foreground"
        >
          <ComboboxPrimitive.Icon render={<ChevronDownIcon className="size-4" />} />
        </ComboboxPrimitive.Trigger>
      </ComboboxPrimitive.InputGroup>
      <ComboboxPrimitive.Portal>
        <ComboboxPrimitive.Positioner className="isolate z-50" sideOffset={4}>
          <ComboboxPrimitive.Popup className="max-h-(--available-height) w-(--anchor-width) min-w-36 origin-(--transform-origin) overflow-y-auto rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95">
            <ComboboxPrimitive.Status>
              {loading ? <div className={MESSAGE_SURFACE}>{loadingMessage}</div> : null}
            </ComboboxPrimitive.Status>
            <ComboboxPrimitive.Empty>
              {loading ? null : <div className={MESSAGE_SURFACE}>{emptyMessage}</div>}
            </ComboboxPrimitive.Empty>
            <ComboboxPrimitive.List>
              {grouped
                ? (group: PrimitiveGroup) => (
                    <ComboboxPrimitive.Group
                      key={group.value}
                      items={group.items}
                      className="pb-1 last:pb-0"
                    >
                      <ComboboxPrimitive.GroupLabel className="px-1.5 py-1 text-xs text-muted-foreground">
                        {group.value}
                      </ComboboxPrimitive.GroupLabel>
                      <ComboboxPrimitive.Collection>{renderOption}</ComboboxPrimitive.Collection>
                    </ComboboxPrimitive.Group>
                  )
                : renderOption}
            </ComboboxPrimitive.List>
          </ComboboxPrimitive.Popup>
        </ComboboxPrimitive.Positioner>
      </ComboboxPrimitive.Portal>
    </ComboboxPrimitive.Root>
  );
}
