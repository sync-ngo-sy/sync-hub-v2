import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
} from '@sync/ui/components/ui/field';
import { type ReactNode, useId } from 'react';
import {
  type Control,
  type ControllerRenderProps,
  type FieldPath,
  type FieldValues,
  useController,
} from 'react-hook-form';

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
  label: ReactNode;
  description?: ReactNode;
  orientation?: 'vertical' | 'horizontal';
  className?: string;
  children: (field: FormFieldControl<TFieldValues, TName>) => ReactNode;
}

export function FormField<TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>>({
  control,
  name,
  label,
  description,
  orientation = 'vertical',
  className,
  children,
}: FormFieldProps<TFieldValues, TName>) {
  const { field, fieldState } = useController({ control, name });
  const id = `${name}-${useId()}`;
  const descriptionId = `${id}-description`;
  const errorId = `${id}-error`;
  const error = fieldState.error?.message;
  const describedBy =
    [description ? descriptionId : null, error ? errorId : null].filter(Boolean).join(' ') ||
    undefined;

  const controlElement = children({
    ...field,
    id,
    'aria-describedby': describedBy,
    'aria-invalid': error ? true : undefined,
  });
  const labelElement = <FieldLabel htmlFor={id}>{label}</FieldLabel>;
  const descriptionElement = description ? (
    <FieldDescription id={descriptionId}>{description}</FieldDescription>
  ) : null;
  const errorElement = error ? <FieldError id={errorId}>{error}</FieldError> : null;

  if (orientation === 'horizontal') {
    return (
      <Field orientation="horizontal" className={className}>
        {controlElement}
        <FieldContent>
          {labelElement}
          {descriptionElement}
          {errorElement}
        </FieldContent>
      </Field>
    );
  }

  return (
    <Field className={className}>
      {labelElement}
      {controlElement}
      {descriptionElement}
      {errorElement}
    </Field>
  );
}
