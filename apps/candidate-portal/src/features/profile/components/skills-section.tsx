import { FormField } from '@sync/ui/components/form-field';
import { Input } from '@sync/ui/components/ui/input';
import { Sparkles, Wrench } from 'lucide-react';
import { type Control, useFieldArray, useWatch } from 'react-hook-form';
import { ReferencePicker } from '@/features/reference/components/reference-picker';
import { useCanonicalSkills } from '@/features/reference/hooks/use-canonical-skills';
import { skillGroups } from '@/features/reference/options';
import { BLANK_SKILL, BLANK_UNMAPPED_SKILL, type ProfileFormValues } from '../schemas/profile';
import { takenElsewhere } from '../taken-elsewhere';
import { EntryList } from './entry-list';
import { ProfileSection } from './profile-section';

export function SkillsSection({ control }: { control: Control<ProfileFormValues> }) {
  const skills = useFieldArray({ control, name: 'skills' });
  const others = useFieldArray({ control, name: 'unmapped_skills' });
  const taxonomy = useCanonicalSkills();
  const listed = useWatch({ control, name: 'skills' });

  return (
    <>
      <ProfileSection
        title="Skills"
        description="Chosen from the platform's list — these are what Screening reads."
      >
        <EntryList
          ids={skills.fields.map((field) => field.id)}
          label={(index) => `Skill ${index + 1}`}
          icon={Wrench}
          addLabel="Add a skill"
          empty="No skills listed yet — Screening reads these, so start here."
          onAdd={() => skills.append(BLANK_SKILL)}
          onRemove={skills.remove}
        >
          {(index) => (
            <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
              <FormField control={control} name={`skills.${index}.name`} label="Skill">
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
                  />
                )}
              </FormField>
              <FormField
                control={control}
                name={`skills.${index}.years_experience`}
                label="Years"
                description="To one decimal."
              >
                {(field) => <Input {...field} inputMode="decimal" placeholder="3.5" />}
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
        <EntryList
          ids={others.fields.map((field) => field.id)}
          label={(index) => `Other skill ${index + 1}`}
          icon={Sparkles}
          addLabel="Add another skill"
          empty="Nothing here yet — add anything the platform has no name for."
          onAdd={() => others.append(BLANK_UNMAPPED_SKILL)}
          onRemove={others.remove}
        >
          {(index) => (
            <FormField control={control} name={`unmapped_skills.${index}.value`} label="Skill">
              {(field) => <Input {...field} placeholder="Kobo Toolbox" />}
            </FormField>
          )}
        </EntryList>
      </ProfileSection>
    </>
  );
}
