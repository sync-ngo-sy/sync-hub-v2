import { FormField } from '@sync/ui/components/form-field';
import { Badge } from '@sync/ui/components/ui/badge';
import { Button } from '@sync/ui/components/ui/button';
import { Input } from '@sync/ui/components/ui/input';
import { Plus, Wrench, X } from 'lucide-react';
import { useState } from 'react';
import { type Control, useFieldArray, useWatch } from 'react-hook-form';
import { ReferencePicker } from '@/features/reference/components/reference-picker';
import { useCanonicalSkills } from '@/features/reference/hooks/use-canonical-skills';
import { skillGroups } from '@/features/reference/options';
import {
  BLANK_SKILL,
  BLANK_UNMAPPED_SKILL,
  MAX_ENTRIES,
  type ProfileFormValues,
} from '../schemas/profile';
import { takenElsewhere } from '../taken-elsewhere';
import { EntryList } from './entry-list';
import { ProfileSection } from './profile-section';
import { SectionError } from './section-error';

export function SkillsSection({ control }: { control: Control<ProfileFormValues> }) {
  const skills = useFieldArray({ control, name: 'skills' });
  const others = useFieldArray({ control, name: 'unmapped_skills' });
  const taxonomy = useCanonicalSkills();
  const listed = useWatch({ control, name: 'skills' });
  const otherValues = useWatch({ control, name: 'unmapped_skills' });
  const [editingOther, setEditingOther] = useState<number | null>(null);

  const addOther = () => {
    const index = others.fields.length;
    others.append(BLANK_UNMAPPED_SKILL);
    setEditingOther(index);
  };

  const removeOther = (index: number) => {
    others.remove(index);
    setEditingOther((current) => {
      if (current === null || current < index) return current;
      if (current === index) return null;
      return current - 1;
    });
  };

  return (
    <>
      <ProfileSection
        title="Skills"
        description="Chosen from the platform's list — these are what Screening reads."
        needed="One skill needed to apply"
      >
        <SectionError control={control} name="skills" />
        <EntryList
          ids={skills.fields.map((field) => field.id)}
          label={(index) => `Skill ${index + 1}`}
          icon={Wrench}
          addLabel="Add a skill"
          empty="No skills listed yet — Screening reads these, so start here."
          variant="compact-grid"
          onAdd={() => skills.append(BLANK_SKILL)}
          onRemove={skills.remove}
        >
          {(index) => (
            <div className="grid grid-cols-[minmax(0,1fr)_4rem] gap-2">
              <FormField
                control={control}
                name={`skills.${index}.name`}
                label="Skill"
                className="min-w-0"
              >
                {({ value, onChange, onBlur, id, ...aria }) => (
                  <ReferencePicker
                    id={id}
                    noun="skill"
                    list={taxonomy}
                    options={skillGroups(
                      taxonomy.data,
                      takenElsewhere(listed, index, (entry) => entry.name),
                    )}
                    value={value || null}
                    onChange={onChange}
                    onBlur={onBlur}
                    aria-describedby={aria['aria-describedby']}
                    aria-invalid={aria['aria-invalid']}
                    className="min-w-0 [&_input]:min-w-0"
                  />
                )}
              </FormField>
              <FormField control={control} name={`skills.${index}.years_experience`} label="Years">
                {(field) => (
                  <Input
                    {...field}
                    type="number"
                    inputMode="decimal"
                    min="0"
                    max="999.9"
                    step="1"
                    placeholder="3.5"
                  />
                )}
              </FormField>
            </div>
          )}
        </EntryList>
      </ProfileSection>

      <ProfileSection
        title="Other skills"
        description="Skills the platform has no name for, written however you like. Recruiters read
          these; Screening does not."
      >
        {others.fields.length === 0 ? (
          <p className="text-dense text-muted-foreground">
            Nothing here yet — add anything the platform has no name for.
          </p>
        ) : null}

        <ul aria-label="Other skills" className="flex flex-wrap items-start gap-2">
          {others.fields.map((field, index) => {
            const value = otherValues[index]?.value ?? '';
            if (editingOther === index) {
              return (
                <li key={field.id} className="w-full max-w-sm">
                  <fieldset aria-label={`Other skill ${index + 1}`}>
                    <FormField
                      control={control}
                      name={`unmapped_skills.${index}.value`}
                      label="Skill"
                    >
                      {({ onBlur, ...input }) => (
                        <Input
                          {...input}
                          placeholder="Kobo Toolbox"
                          onBlur={(event) => {
                            onBlur();
                            if (event.currentTarget.value.trim()) setEditingOther(null);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' && event.currentTarget.value.trim()) {
                              event.preventDefault();
                              event.currentTarget.blur();
                            }
                          }}
                        />
                      )}
                    </FormField>
                  </fieldset>
                </li>
              );
            }
            return (
              <li key={field.id}>
                <Badge variant="tag" className="h-7 gap-1 pl-2.5 pr-1 text-dense">
                  {value}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    className="size-5 rounded-full"
                    aria-label={`Remove ${value}`}
                    onClick={() => removeOther(index)}
                  >
                    <X />
                  </Button>
                </Badge>
              </li>
            );
          })}
        </ul>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addOther}
          disabled={others.fields.length >= MAX_ENTRIES || editingOther !== null}
        >
          <Plus data-icon="inline-start" />
          Add another skill
        </Button>
      </ProfileSection>
    </>
  );
}
