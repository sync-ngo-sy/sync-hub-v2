import {
  Combobox,
  type ComboboxOption,
  type ComboboxOptionGroup,
} from '@sync/ui/components/combobox';

interface ReferencePickerProps {
  /** A labelled field's own id. A field named by `aria-label` instead needs none. */
  id?: string;
  /** Null is an unmade choice. A field that reads a blank as a choice passes its own value. */
  value: string | null;
  onChange: (value: string) => void;
  /** A form's way of answering a field the moment it is left. A filter bar has nothing to say. */
  onBlur?: () => void;
  options: ComboboxOption[] | ComboboxOptionGroup[];
  /** Whichever taxonomy query feeds `options`, so the panel can say which of the three it is. */
  list: { isPending: boolean; isError: boolean };
  /** Singular, lowercase — 'skill', 'language'. */
  noun: string;
  /** Only where the field carries no visible label of its own, as a filter bar's do not. */
  placeholder?: string;
  className?: string;
  'aria-label'?: string;
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
  placeholder = 'Type to search',
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
      placeholder={placeholder}
      loading={list.isPending}
      loadingMessage={`Loading ${noun}s…`}
      emptyMessage={
        list.isError ? `The ${noun} list couldn't be loaded.` : `No ${noun} by that name.`
      }
      aria-label={aria['aria-label']}
      aria-describedby={aria['aria-describedby']}
      aria-invalid={aria['aria-invalid']}
    />
  );
}
