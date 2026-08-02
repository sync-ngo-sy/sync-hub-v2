import {
  Combobox,
  type ComboboxOption,
  type ComboboxOptionGroup,
} from '@sync/ui/components/combobox';

interface ReferencePickerProps {
  id: string;
  /** Null is an unmade choice. A field that reads a blank as a choice passes its own value. */
  value: string | null;
  onChange: (value: string) => void;
  onBlur: () => void;
  options: ComboboxOption[] | ComboboxOptionGroup[];
  /** Whichever taxonomy query feeds `options`, so the panel can say which of the two it is. */
  list: { isPending: boolean; isError: boolean };
  /** Singular, lowercase — 'skill', 'language'. */
  noun: string;
  disabled?: boolean;
  className?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
}

/** Every field the API constrains, rendered the same way: a picker over a fetched taxonomy that
 * never mistakes a list still arriving, or one that failed, for a list with nothing in it. */
export function ReferencePicker({
  id,
  value,
  onChange,
  onBlur,
  options,
  list,
  noun,
  disabled,
  className,
  ...aria
}: ReferencePickerProps) {
  return (
    <Combobox
      id={id}
      className={className}
      options={options}
      value={value}
      onValueChange={(chosen) => onChange(chosen ?? '')}
      onBlur={onBlur}
      disabled={disabled}
      placeholder="Type to search"
      loading={list.isPending}
      loadingMessage={`Loading ${noun}s…`}
      emptyMessage={
        list.isError ? `The ${noun} list couldn't be loaded.` : `No ${noun} by that name.`
      }
      aria-describedby={aria['aria-describedby']}
      aria-invalid={aria['aria-invalid']}
    />
  );
}
