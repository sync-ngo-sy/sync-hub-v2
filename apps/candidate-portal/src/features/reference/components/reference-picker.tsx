import {
  Combobox,
  type ComboboxOption,
  type ComboboxOptionGroup,
} from '@sync/ui/components/combobox';

interface ReferencePickerProps {
  id?: string;
  value: string | null;
  onChange: (value: string) => void;
  onBlur?: () => void;
  options: ComboboxOption[] | ComboboxOptionGroup[];
  list: { isPending: boolean; isError: boolean };
  noun: string;
  placeholder?: string;
  className?: string;
  'aria-label'?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
}

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
