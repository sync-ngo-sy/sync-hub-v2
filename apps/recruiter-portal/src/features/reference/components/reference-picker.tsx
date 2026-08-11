import {
  Combobox,
  type ComboboxOption,
  type ComboboxOptionGroup,
} from '@sync/ui/components/combobox';

interface ReferencePickerBaseProps {
  id: string;
  onBlur: () => void;
  options: ComboboxOption[] | ComboboxOptionGroup[];
  list: { isPending: boolean; isError: boolean };
  noun: string;
  className?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
}

interface OnePickedProps extends ReferencePickerBaseProps {
  multiple?: false;
  value: string | null;
  onChange: (value: string) => void;
}

interface ManyPickedProps extends ReferencePickerBaseProps {
  multiple: true;
  value: string[];
  onChange: (value: string[]) => void;
}

export type ReferencePickerProps = OnePickedProps | ManyPickedProps;

export function ReferencePicker(props: ReferencePickerProps) {
  const { id, onBlur, options, list, noun, className, ...aria } = props;
  const shared = {
    id,
    className,
    options,
    onBlur,
    placeholder: 'Type to search',
    loading: list.isPending,
    loadingMessage: `Loading ${noun}s…`,
    emptyMessage: list.isError
      ? `The ${noun} list couldn't be loaded.`
      : `No ${noun} by that name.`,
    'aria-describedby': aria['aria-describedby'],
    'aria-invalid': aria['aria-invalid'],
  };

  if (props.multiple) {
    return <Combobox {...shared} multiple value={props.value} onValueChange={props.onChange} />;
  }

  return (
    <Combobox {...shared} value={props.value} onValueChange={(one) => props.onChange(one ?? '')} />
  );
}
