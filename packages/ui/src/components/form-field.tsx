import { Label } from '@sync/ui/components/ui/label';
import { cn } from '@sync/ui/lib/utils';
import { type ReactNode, useId } from 'react';
import {
  type Control,
  type ControllerRenderProps,
  type FieldPath,
  type FieldValues,
  useController,
} from 'react-hook-form';

/** What the render-prop child spreads onto its control to wire label, error, and description. */
export type FormFieldControl<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
> = ControllerRenderProps<TFieldValues, TName> & {
  id: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
};

interface FormFieldProps<TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>> {
  control: Control<TFieldValues>;
  name: TName;
  label: string;
  description?: string;
  className?: string;
  children: (field: FormFieldControl<TFieldValues, TName>) => ReactNode;
}

/**
 * Wraps a single React Hook Form field: renders its label, an optional description, and the
 * validation error, and hands the control everything it needs to be accessible — a shared
 * `id` (so the label points at it), `aria-invalid`, and an `aria-describedby` that resolves
 * to the description and/or error currently on screen.
 */
export function FormField<TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>>({
  control,
  name,
  label,
  description,
  className,
  children,
}: FormFieldProps<TFieldValues, TName>) {
  const { field, fieldState } = useController({ control, name });
  const id = useId();
  const descriptionId = `${id}-description`;
  const errorId = `${id}-error`;
  const error = fieldState.error?.message;
  const describedBy =
    [description ? descriptionId : null, error ? errorId : null].filter(Boolean).join(' ') ||
    undefined;

  return (
    <div className={cn('grid gap-1.5', className)}>
      <Label htmlFor={id}>{label}</Label>
      {children({
        ...field,
        id,
        'aria-describedby': describedBy,
        'aria-invalid': error ? true : undefined,
      })}
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
