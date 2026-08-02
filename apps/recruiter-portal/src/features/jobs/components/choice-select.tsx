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

/** Every closed set a Job carries, rendered the same way: the whole set on screen, in the
 * order the map lists it, and nowhere to type a value that is not in it. */
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
    <Select
      items={items}
      name={field.name}
      value={field.value}
      disabled={field.disabled}
      onValueChange={onValueChange}
    >
      <SelectTrigger
        id={field.id}
        onBlur={field.onBlur}
        className="w-full"
        aria-describedby={field['aria-describedby']}
        aria-invalid={field['aria-invalid']}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {(Object.entries(items) as [Value, string][]).map(([value, label]) => (
          <SelectItem key={value} value={value}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
