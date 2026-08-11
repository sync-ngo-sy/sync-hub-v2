import type { FieldPath } from 'react-hook-form';
import { isProblem, problemFields, problemMessage, problemStatus } from '@/lib/api-problem';
import { SEARCHABLE_NEEDS_CV_PROBLEM } from './problems';
import type { ProfileFormValues } from './schemas/profile';

type ProfileField = FieldPath<ProfileFormValues>;

export interface ProfileRejection {
  fields: { name: ProfileField; message: string }[];
  root: string | null;
}

const IDENTITY_FIELDS = [
  'full_name',
  'phone',
  'headline',
  'summary',
  'location_key',
  'is_searchable',
] as const satisfies readonly (keyof ProfileFormValues)[];

type Section = Exclude<
  {
    [Name in keyof ProfileFormValues]-?: ProfileFormValues[Name] extends readonly unknown[]
      ? Name
      : never;
  }[keyof ProfileFormValues],
  'unmapped_skills'
>;

const SECTION_FIELDS: Record<Section, readonly string[]> = {
  experiences: [
    'job_title',
    'company_name',
    'start_year',
    'start_month',
    'end_year',
    'end_month',
    'is_current',
    'description',
  ],
  educations: ['institution', 'degree', 'field_of_study', 'graduation_year', 'description'],
  skills: ['name', 'years_experience'],
  languages: ['code', 'proficiency'],
  projects: [
    'name',
    'description',
    'project_url',
    'repository_url',
    'start_year',
    'start_month',
    'end_year',
    'end_month',
  ],
};

function fieldFor(location: string): ProfileField | null {
  if (!location.startsWith('body.')) return null;
  const [section, index, field] = location.slice('body.'.length).split('.');
  if (section === undefined) return null;

  if (index === undefined) {
    return IDENTITY_FIELDS.some((name) => name === section) ? (section as ProfileField) : null;
  }
  if (!/^\d+$/.test(index)) return null;

  if (section === 'unmapped_skills' && field === undefined) {
    return `unmapped_skills.${Number(index)}.value`;
  }
  if (!isSection(section) || field === undefined) return null;
  return SECTION_FIELDS[section].includes(field)
    ? (`${section}.${index}.${field}` as ProfileField)
    : null;
}

const isSection = (name: string): name is Section => name in SECTION_FIELDS;

export function profileRejection(error: unknown): ProfileRejection | null {
  if (isProblem(error, SEARCHABLE_NEEDS_CV_PROBLEM)) {
    return {
      fields: [
        {
          name: 'is_searchable',
          message: problemMessage(error, 'Global search needs a current, processed CV first.'),
        },
      ],
      root: null,
    };
  }

  if (problemStatus(error) !== 422) return null;

  const located = problemFields(error).map((entry) => ({
    name: fieldFor(entry.location),
    message: entry.message,
  }));
  const fields = located.filter(
    (entry): entry is { name: ProfileField; message: string } => entry.name !== null,
  );

  return {
    fields,
    root:
      fields.length === located.length && located.length > 0
        ? null
        : problemMessage(error, "Your profile couldn't be saved."),
  };
}
