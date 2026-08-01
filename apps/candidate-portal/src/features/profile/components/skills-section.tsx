import { FormField } from '@sync/ui/components/form-field';
import { Input } from '@sync/ui/components/ui/input';
import { type Control, useFieldArray } from 'react-hook-form';
import { BLANK_SKILL, BLANK_UNMAPPED_SKILL, type ProfileFormValues } from '../schemas/profile';
import { EntryList } from './entry-list';
import { ProfileSection } from './profile-section';

export function SkillsSection({ control }: { control: Control<ProfileFormValues> }) {
  const skills = useFieldArray({ control, name: 'skills' });
  const others = useFieldArray({ control, name: 'unmapped_skills' });

  return (
    <>
      <ProfileSection
        title="Skills"
        description="Named exactly as the platform names them — these are what Screening reads."
      >
        <EntryList
          ids={skills.fields.map((field) => field.id)}
          label={(index) => `Skill ${index + 1}`}
          addLabel="Add a skill"
          empty="No skills listed yet."
          onAdd={() => skills.append(BLANK_SKILL)}
          onRemove={skills.remove}
        >
          {(index) => (
            <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
              <FormField control={control} name={`skills.${index}.name`} label="Skill">
                {(field) => <Input {...field} placeholder="Python" />}
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
        description="Anything the platform has no name for yet. Recruiters read these; Screening does not."
      >
        <EntryList
          ids={others.fields.map((field) => field.id)}
          label={(index) => `Other skill ${index + 1}`}
          addLabel="Add another skill"
          empty="No other skills listed yet."
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
