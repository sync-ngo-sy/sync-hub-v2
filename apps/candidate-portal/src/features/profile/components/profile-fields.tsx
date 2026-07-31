import { FormField } from '@sync/ui/components/form-field';
import { Input } from '@sync/ui/components/ui/input';
import { Label } from '@sync/ui/components/ui/label';
import { cn } from '@sync/ui/lib/utils';
import { useId } from 'react';
import { type Control, type FieldPath, useController } from 'react-hook-form';
import type { ProfileFormValues } from '../schemas/profile-schema';

type Name = FieldPath<ProfileFormValues>;

interface FieldProps<TName extends Name> {
  control: Control<ProfileFormValues, unknown>;
  name: TName;
  label: string;
  description?: string;
  className?: string;
}

// Matches the Input primitive so textareas and selects sit in the same visual language.
const controlClass =
  'w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40';

export function TextField<TName extends Name>({
  control,
  name,
  label,
  description,
  className,
  type = 'text',
  autoComplete,
  inputMode,
}: FieldProps<TName> & {
  type?: string;
  autoComplete?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
}) {
  return (
    <FormField
      control={control}
      name={name}
      label={label}
      description={description}
      className={className}
    >
      {(field) => (
        <Input
          {...field}
          value={(field.value ?? '') as string}
          type={type}
          autoComplete={autoComplete}
          inputMode={inputMode}
        />
      )}
    </FormField>
  );
}

export function TextAreaField<TName extends Name>({
  control,
  name,
  label,
  description,
  className,
  rows = 3,
}: FieldProps<TName> & { rows?: number }) {
  return (
    <FormField
      control={control}
      name={name}
      label={label}
      description={description}
      className={className}
    >
      {(field) => (
        <textarea
          {...field}
          value={(field.value ?? '') as string}
          rows={rows}
          className={cn(controlClass, 'py-1.5')}
        />
      )}
    </FormField>
  );
}

export function NumberField<TName extends Name>({
  control,
  name,
  label,
  description,
  className,
  min,
  max,
  placeholder,
}: FieldProps<TName> & { min?: number; max?: number; placeholder?: string }) {
  return (
    <FormField
      control={control}
      name={name}
      label={label}
      description={description}
      className={className}
    >
      {(field) => (
        <Input
          {...field}
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          placeholder={placeholder}
          value={field.value == null ? '' : String(field.value)}
          onChange={(event) => {
            const { value, valueAsNumber } = event.target;
            field.onChange(value === '' || Number.isNaN(valueAsNumber) ? null : valueAsNumber);
          }}
        />
      )}
    </FormField>
  );
}

export function SelectField<TName extends Name>({
  control,
  name,
  label,
  description,
  className,
  options,
}: FieldProps<TName> & { options: readonly { value: string; label: string }[] }) {
  return (
    <FormField
      control={control}
      name={name}
      label={label}
      description={description}
      className={className}
    >
      {(field) => (
        <select
          {...field}
          value={(field.value ?? '') as string}
          className={cn(controlClass, 'h-8')}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}
    </FormField>
  );
}

/** A checkbox reads best with its label beside it, so it owns its layout rather than using FormField. */
export function CheckboxField<TName extends Name>({
  control,
  name,
  label,
  description,
}: FieldProps<TName>) {
  const { field, fieldState } = useController({ control, name });
  const id = useId();
  const descriptionId = `${id}-description`;
  const errorId = `${id}-error`;
  const error = fieldState.error?.message;
  const describedBy =
    [description ? descriptionId : null, error ? errorId : null].filter(Boolean).join(' ') ||
    undefined;

  return (
    <div className="grid gap-1.5">
      <div className="flex items-center gap-2">
        <input
          id={id}
          name={field.name}
          ref={field.ref}
          type="checkbox"
          checked={Boolean(field.value)}
          onBlur={field.onBlur}
          onChange={(event) => field.onChange(event.target.checked)}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          className="size-4 rounded border-input text-primary accent-primary focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        <Label htmlFor={id}>{label}</Label>
      </div>
      {description ? (
        <p id={descriptionId} className="text-sm text-muted-foreground">
          {description}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-sm text-destructive-foreground">
          {error}
        </p>
      ) : null}
    </div>
  );
}
