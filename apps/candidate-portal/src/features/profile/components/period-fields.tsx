import { FormField } from '@sync/ui/components/form-field';
import { Input } from '@sync/ui/components/ui/input';
import type { Control } from 'react-hook-form';
import type { ProfileFormValues } from '../schemas/profile';

interface PeriodFieldsProps {
  control: Control<ProfileFormValues>;
  section: 'experiences' | 'projects';
  index: number;
}

/** Year and month apart, as the API stores them: a month nobody knows stays empty. */
export function PeriodFields({ control, section, index }: PeriodFieldsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="grid grid-cols-2 gap-3">
        <FormField control={control} name={`${section}.${index}.start_year`} label="Start year">
          {(field) => <Input {...field} inputMode="numeric" placeholder="2020" />}
        </FormField>
        <FormField control={control} name={`${section}.${index}.start_month`} label="Start month">
          {(field) => <Input {...field} inputMode="numeric" placeholder="1–12" />}
        </FormField>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <FormField control={control} name={`${section}.${index}.end_year`} label="End year">
          {(field) => <Input {...field} inputMode="numeric" placeholder="2024" />}
        </FormField>
        <FormField control={control} name={`${section}.${index}.end_month`} label="End month">
          {(field) => <Input {...field} inputMode="numeric" placeholder="1–12" />}
        </FormField>
      </div>
    </div>
  );
}
