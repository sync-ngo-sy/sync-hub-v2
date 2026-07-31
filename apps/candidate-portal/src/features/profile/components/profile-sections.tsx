import { Button } from '@sync/ui/components/ui/button';
import type { ReactNode } from 'react';
import { type Control, useFieldArray } from 'react-hook-form';
import { MAX_ENTRIES, PROFICIENCIES, type ProfileFormValues } from '../schemas/profile-schema';
import {
  CheckboxField,
  NumberField,
  SelectField,
  TextAreaField,
  TextField,
} from './profile-fields';

type Control_ = Control<ProfileFormValues, unknown>;

const PROFICIENCY_OPTIONS = PROFICIENCIES.map((value) => ({
  value,
  label: value.charAt(0).toUpperCase() + value.slice(1),
}));

interface SectionShellProps {
  title: string;
  description?: string;
  singular: string;
  addLabel: string;
  count: number;
  emptyText: string;
  onAdd: () => void;
  onRemove: (index: number) => void;
  renderItem: (index: number) => ReactNode;
  itemKeys: string[];
}

function SectionShell({
  title,
  description,
  singular,
  addLabel,
  count,
  emptyText,
  onAdd,
  onRemove,
  renderItem,
  itemKeys,
}: SectionShellProps) {
  return (
    <fieldset className="space-y-4">
      <div className="space-y-1">
        <legend className="font-heading text-foreground text-lg">{title}</legend>
        {description ? <p className="text-muted-foreground text-sm">{description}</p> : null}
      </div>
      {count === 0 ? (
        <p className="text-muted-foreground text-sm">{emptyText}</p>
      ) : (
        <ol className="space-y-4">
          {itemKeys.map((key, index) => (
            <li key={key} className="space-y-3 rounded-lg border border-border p-4">
              {renderItem(index)}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onRemove(index)}
                aria-label={`Remove ${singular} ${index + 1}`}
              >
                Remove
              </Button>
            </li>
          ))}
        </ol>
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onAdd}
        disabled={count >= MAX_ENTRIES}
      >
        {addLabel}
      </Button>
    </fieldset>
  );
}

export function ExperienceSection({ control }: { control: Control_ }) {
  const { fields, append, remove } = useFieldArray({ control, name: 'experiences' });
  const add = () =>
    append({
      job_title: '',
      company_name: '',
      start_year: null,
      start_month: null,
      end_year: null,
      end_month: null,
      is_current: false,
      description: '',
    });

  return (
    <SectionShell
      title="Work experience"
      singular="job"
      addLabel="Add a job"
      emptyText="No jobs listed yet."
      count={fields.length}
      itemKeys={fields.map((field) => field.id)}
      onAdd={add}
      onRemove={remove}
      renderItem={(index) => (
        <>
          <TextField control={control} name={`experiences.${index}.job_title`} label="Job title" />
          <TextField control={control} name={`experiences.${index}.company_name`} label="Company" />
          <div className="grid grid-cols-2 gap-3">
            <NumberField
              control={control}
              name={`experiences.${index}.start_year`}
              label="Start year"
              min={1900}
              max={2100}
            />
            <NumberField
              control={control}
              name={`experiences.${index}.start_month`}
              label="Start month"
              min={1}
              max={12}
            />
            <NumberField
              control={control}
              name={`experiences.${index}.end_year`}
              label="End year"
              min={1900}
              max={2100}
            />
            <NumberField
              control={control}
              name={`experiences.${index}.end_month`}
              label="End month"
              min={1}
              max={12}
            />
          </div>
          <CheckboxField
            control={control}
            name={`experiences.${index}.is_current`}
            label="I currently work here"
          />
          <TextAreaField
            control={control}
            name={`experiences.${index}.description`}
            label="Description"
          />
        </>
      )}
    />
  );
}

export function EducationSection({ control }: { control: Control_ }) {
  const { fields, append, remove } = useFieldArray({ control, name: 'educations' });
  const add = () =>
    append({
      institution: '',
      degree: '',
      field_of_study: '',
      graduation_year: null,
      description: '',
    });

  return (
    <SectionShell
      title="Education"
      singular="qualification"
      addLabel="Add a qualification"
      emptyText="No qualifications listed yet."
      count={fields.length}
      itemKeys={fields.map((field) => field.id)}
      onAdd={add}
      onRemove={remove}
      renderItem={(index) => (
        <>
          <TextField
            control={control}
            name={`educations.${index}.institution`}
            label="Institution"
          />
          <TextField control={control} name={`educations.${index}.degree`} label="Degree" />
          <TextField
            control={control}
            name={`educations.${index}.field_of_study`}
            label="Field of study"
          />
          <NumberField
            control={control}
            name={`educations.${index}.graduation_year`}
            label="Graduation year"
            min={1900}
            max={2100}
          />
          <TextAreaField
            control={control}
            name={`educations.${index}.description`}
            label="Description"
          />
        </>
      )}
    />
  );
}

export function SkillSection({ control }: { control: Control_ }) {
  const { fields, append, remove } = useFieldArray({ control, name: 'skills' });
  const add = () => append({ name: '', years_experience: null });

  return (
    <SectionShell
      title="Skills"
      description="Each skill is matched to Sync's Canonical list when you save."
      singular="skill"
      addLabel="Add a skill"
      emptyText="No skills listed yet."
      count={fields.length}
      itemKeys={fields.map((field) => field.id)}
      onAdd={add}
      onRemove={remove}
      renderItem={(index) => (
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField control={control} name={`skills.${index}.name`} label="Skill" />
          <NumberField
            control={control}
            name={`skills.${index}.years_experience`}
            label="Years of experience"
            min={0}
            max={999.9}
          />
        </div>
      )}
    />
  );
}

export function LanguageSection({ control }: { control: Control_ }) {
  const { fields, append, remove } = useFieldArray({ control, name: 'languages' });
  const add = () => append({ code: '', proficiency: 'beginner' });

  return (
    <SectionShell
      title="Languages"
      singular="language"
      addLabel="Add a language"
      emptyText="No languages listed yet."
      count={fields.length}
      itemKeys={fields.map((field) => field.id)}
      onAdd={add}
      onRemove={remove}
      renderItem={(index) => (
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField
            control={control}
            name={`languages.${index}.code`}
            label="Language code"
            description="An ISO code such as en, ar, or fr."
          />
          <SelectField
            control={control}
            name={`languages.${index}.proficiency`}
            label="Proficiency"
            options={PROFICIENCY_OPTIONS}
          />
        </div>
      )}
    />
  );
}

export function ProjectSection({ control }: { control: Control_ }) {
  const { fields, append, remove } = useFieldArray({ control, name: 'projects' });
  const add = () =>
    append({
      name: '',
      description: '',
      project_url: '',
      repository_url: '',
      start_year: null,
      start_month: null,
      end_year: null,
      end_month: null,
    });

  return (
    <SectionShell
      title="Projects"
      singular="project"
      addLabel="Add a project"
      emptyText="No projects listed yet."
      count={fields.length}
      itemKeys={fields.map((field) => field.id)}
      onAdd={add}
      onRemove={remove}
      renderItem={(index) => (
        <>
          <TextField control={control} name={`projects.${index}.name`} label="Project name" />
          <TextAreaField
            control={control}
            name={`projects.${index}.description`}
            label="Description"
          />
          <TextField
            control={control}
            name={`projects.${index}.project_url`}
            label="Project URL"
            type="url"
          />
          <TextField
            control={control}
            name={`projects.${index}.repository_url`}
            label="Repository URL"
            type="url"
          />
          <div className="grid grid-cols-2 gap-3">
            <NumberField
              control={control}
              name={`projects.${index}.start_year`}
              label="Start year"
              min={1900}
              max={2100}
            />
            <NumberField
              control={control}
              name={`projects.${index}.start_month`}
              label="Start month"
              min={1}
              max={12}
            />
            <NumberField
              control={control}
              name={`projects.${index}.end_year`}
              label="End year"
              min={1900}
              max={2100}
            />
            <NumberField
              control={control}
              name={`projects.${index}.end_month`}
              label="End month"
              min={1}
              max={12}
            />
          </div>
        </>
      )}
    />
  );
}

export function UnmappedSkillSection({ control }: { control: Control_ }) {
  const { fields, append, remove } = useFieldArray({ control, name: 'unmapped_skills' });
  const add = () => append({ value: '' });

  return (
    <SectionShell
      title="Other skills"
      description="Skills Sync has no Canonical name for yet. Recruiters read them as you type them."
      singular="skill"
      addLabel="Add another skill"
      emptyText="No other skills listed yet."
      count={fields.length}
      itemKeys={fields.map((field) => field.id)}
      onAdd={add}
      onRemove={remove}
      renderItem={(index) => (
        <TextField
          control={control}
          name={`unmapped_skills.${index}.value`}
          label={`Skill ${index + 1}`}
        />
      )}
    />
  );
}
