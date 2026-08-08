import {
  Combobox,
  type ComboboxOption,
  type ComboboxOptionGroup,
} from '@sync/ui/components/combobox';

interface ReferenceMultiPickerProps {
  id: string;
  value: string[];
  onChange: (value: string[]) => void;
  onBlur: () => void;
  options: ComboboxOption[] | ComboboxOptionGroup[];
  list: { isPending: boolean; isError: boolean };
  noun: string;
  className?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
}

export function ReferenceMultiPicker({
  id,
  value,
  onChange,
  onBlur,
  options,
  list,
  noun,
  className,
  ...aria
}: ReferenceMultiPickerProps) {
  return (
    <Combobox
      multiple
      id={id}
      className={className}
      options={options}
      value={value}
      onValueChange={onChange}
      onBlur={onBlur}
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
