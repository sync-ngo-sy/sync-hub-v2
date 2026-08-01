import { FormField } from '@sync/ui/components/form-field';
import { Input } from '@sync/ui/components/ui/input';
import { Textarea } from '@sync/ui/components/ui/textarea';
import { FolderGit2 } from 'lucide-react';
import { type Control, useFieldArray } from 'react-hook-form';
import { BLANK_PROJECT, type ProfileFormValues } from '../schemas/profile';
import { EntryList } from './entry-list';
import { PeriodFields } from './period-fields';
import { ProfileSection } from './profile-section';

export function ProjectsSection({ control }: { control: Control<ProfileFormValues> }) {
  const { fields, append, remove } = useFieldArray({ control, name: 'projects' });

  return (
    <ProfileSection title="Projects" description="Things you built or ran, paid or not.">
      <EntryList
        ids={fields.map((field) => field.id)}
        label={(index) => `Project ${index + 1}`}
        icon={FolderGit2}
        addLabel="Add a project"
        empty="No projects listed yet — add something you built or ran."
        onAdd={() => append(BLANK_PROJECT)}
        onRemove={remove}
      >
        {(index) => (
          <>
            <FormField control={control} name={`projects.${index}.name`} label="Project name">
              {(field) => <Input {...field} />}
            </FormField>

            <PeriodFields control={control} section="projects" index={index} />

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField control={control} name={`projects.${index}.project_url`} label="Link">
                {(field) => <Input {...field} inputMode="url" placeholder="https://" />}
              </FormField>
              <FormField
                control={control}
                name={`projects.${index}.repository_url`}
                label="Repository"
              >
                {(field) => <Input {...field} inputMode="url" placeholder="https://" />}
              </FormField>
            </div>

            <FormField control={control} name={`projects.${index}.description`} label="What it is">
              {(field) => <Textarea {...field} rows={3} />}
            </FormField>
          </>
        )}
      </EntryList>
    </ProfileSection>
  );
}
