import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@sync/ui/components/ui/select';

export interface ChoiceField<Value extends string> {
  value: Value;
  onChange: (value: Value) => void;
  onBlur: () => void;
  name: string;
  id: string;
  disabled?: boolean;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
}

interface ChoicePickerProps<Value extends string> {
  value: Value;
  items: Record<Value, string>;
  onValueChange: (value: Value) => void;
  name?: string;
  id?: string;
  label?: string;
  disabled?: boolean;
  onBlur?: () => void;
  describedBy?: string;
  invalid?: boolean;
  className?: string;
}

export function ChoicePicker<Value extends string>({
  value,
  items,
  onValueChange,
  name,
  id,
  label,
  disabled,
  onBlur,
  describedBy,
  invalid,
  className,
}: ChoicePickerProps<Value>) {
  return (
    <Select
      items={items}
      name={name}
      value={value}
      disabled={disabled}
      onValueChange={(next) => {
        if (next !== null) onValueChange(next as Value);
      }}
    >
      <SelectTrigger
        id={id}
        aria-label={label}
        onBlur={onBlur}
        className={className}
        aria-describedby={describedBy}
        aria-invalid={invalid}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {(Object.entries(items) as [Value, string][]).map(([itemValue, itemLabel]) => (
          <SelectItem key={itemValue} value={itemValue}>
            {itemLabel}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function ChoiceSelect<Value extends string>({
  field,
  items,
  onValueChange = (value) => {
    if (value !== null) field.onChange(value);
  },
}: {
  field: ChoiceField<Value>;
  items: Record<Value, string>;
  onValueChange?: (value: Value | null) => void;
}) {
  return (
    <ChoicePicker
      items={items}
      name={field.name}
      value={field.value}
      disabled={field.disabled}
      onValueChange={(value) => onValueChange(value)}
      id={field.id}
      onBlur={field.onBlur}
      className="w-full"
      describedBy={field['aria-describedby']}
      invalid={field['aria-invalid']}
    />
  );
}
