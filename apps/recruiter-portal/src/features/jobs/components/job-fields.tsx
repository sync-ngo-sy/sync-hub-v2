import { FormField } from '@sync/ui/components/form-field';
import { Input } from '@sync/ui/components/ui/input';
import { Textarea } from '@sync/ui/components/ui/textarea';
import type { MouseEvent } from 'react';
import type { Control } from 'react-hook-form';
import { ReferencePicker } from '@/features/reference/components/reference-picker';
import { useLocations } from '@/features/reference/hooks/use-locations';
import { locationGroups } from '@/features/reference/options';
import { EMPLOYMENT_TYPE_LABELS, WORK_MODE_LABELS } from '../job';
import type { JobFormValues } from '../schemas/job';
import { ChoiceSelect } from './choice-select';

const EMPLOYMENT_TYPES = { '': 'Not set', ...EMPLOYMENT_TYPE_LABELS };
const WORK_MODES = { '': 'Not set', ...WORK_MODE_LABELS };

function openThePicker(event: MouseEvent<HTMLInputElement>) {
  try {
    event.currentTarget.showPicker();
  } catch {
    // Browsers that will not open one on demand leave the field to be typed into, as before.
  }
}

export function JobFields({ control }: { control: Control<JobFormValues> }) {
  const places = useLocations();

  return (
    <>
      <FormField control={control} name="title" label="Title">
        {(field) => <Input {...field} value={field.value} autoFocus />}
      </FormField>

      <FormField control={control} name="description" label="Description">
        {(field) => <Textarea {...field} value={field.value} rows={6} />}
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField control={control} name="locationKey" label="Location">
          {({ value, onChange, onBlur, id, ...aria }) => (
            <ReferencePicker
              id={id}
              noun="location"
              list={places}
              options={locationGroups(places.data)}
              value={value || null}
              onChange={onChange}
              onBlur={onBlur}
              aria-describedby={aria['aria-describedby']}
              aria-invalid={aria['aria-invalid']}
            />
          )}
        </FormField>
        <FormField
          control={control}
          name="workMode"
          label="Work mode"
          description={
            'How much of the work happens where the team is, which the Job needs before it ' +
            'goes live. A remote role names where a Candidate must be based, or nowhere at ' +
            'all — which reads as Anywhere.'
          }
        >
          {(field) => <ChoiceSelect field={field} items={WORK_MODES} />}
        </FormField>
        <FormField control={control} name="employmentType" label="Employment type">
          {(field) => <ChoiceSelect field={field} items={EMPLOYMENT_TYPES} />}
        </FormField>
      </div>

      <FormField
        control={control}
        name="expiresAt"
        label="Closing date"
        description="Optional. Leave blank to keep the Job open until you close it."
      >
        {(field) => (
          <Input {...field} value={field.value} type="datetime-local" onClick={openThePicker} />
        )}
      </FormField>
    </>
  );
}
