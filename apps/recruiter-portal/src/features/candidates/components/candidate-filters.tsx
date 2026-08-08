import { zodResolver } from '@hookform/resolvers/zod';
import { FormField } from '@sync/ui/components/form-field';
import { Button } from '@sync/ui/components/ui/button';
import { Input } from '@sync/ui/components/ui/input';
import { Search } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { ReferencePicker } from '@/features/reference/components/reference-picker';
import { useCanonicalRoles } from '@/features/reference/hooks/use-canonical-roles';
import { useCanonicalSkills } from '@/features/reference/hooks/use-canonical-skills';
import { useLocations } from '@/features/reference/hooks/use-locations';
import { locationGroups, roleOptions, skillGroups } from '@/features/reference/options';
import {
  type CandidateSearchValues,
  candidateFilterSchema,
  candidateSearchSchema,
} from '../schemas/candidate-search';
import {
  type CandidateSearchFilters,
  type CandidateTab,
  languagesFrom,
  languageTokens,
} from '../search';
import { LanguageFilter } from './language-filter';

interface CandidateFiltersProps {
  tab: CandidateTab;
  filters: CandidateSearchFilters;
  onSearch: (filters: CandidateSearchFilters) => void;
}

const EMPTY: CandidateSearchValues = {
  q: '',
  location: '',
  languages: [],
  skills: [],
  role: '',
  experience: '',
  keywords: '',
};

function values(filters: CandidateSearchFilters): CandidateSearchValues {
  return {
    q: filters.q,
    location: filters.location ?? '',
    languages: languagesFrom(filters.languages),
    skills: filters.skills ?? [],
    role: filters.role ?? '',
    experience: filters.experience === undefined ? '' : String(filters.experience),
    keywords: filters.keywords ?? '',
  };
}

function asked(values: CandidateSearchValues): CandidateSearchFilters {
  return {
    ...values,
    languages: languageTokens(values.languages),
    experience: values.experience === '' ? undefined : Number(values.experience),
  };
}

export function CandidateFilters({ tab, filters, onSearch }: CandidateFiltersProps) {
  const ranked = tab === 'search';
  const places = useLocations();
  const skills = useCanonicalSkills();
  const roles = useCanonicalRoles();
  const form = useForm<CandidateSearchValues>({
    resolver: zodResolver(ranked ? candidateSearchSchema : candidateFilterSchema),
    values: values(filters),
  });

  const search = form.handleSubmit((written) => onSearch(asked(written)));

  return (
    <form
      onSubmit={search}
      noValidate
      aria-label={ranked ? 'Candidate search' : 'Candidate filters'}
      className="space-y-4"
    >
      {ranked ? (
        <FormField
          control={form.control}
          name="q"
          label="Who are you looking for?"
          description="Plain words. The search reads what they mean, not just the letters in them."
        >
          {(field) => <Input {...field} value={field.value} autoFocus />}
        </FormField>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <FormField control={form.control} name="skills" label="Skills">
          {({ value, onChange, onBlur, id, ...aria }) => (
            <ReferencePicker
              multiple
              id={id}
              noun="skill"
              list={skills}
              options={skillGroups(skills.data)}
              value={value}
              onChange={onChange}
              onBlur={onBlur}
              aria-describedby={aria['aria-describedby']}
              aria-invalid={aria['aria-invalid']}
            />
          )}
        </FormField>

        <FormField control={form.control} name="role" label="Role">
          {({ value, onChange, onBlur, id, ...aria }) => (
            <ReferencePicker
              id={id}
              noun="role"
              list={roles}
              options={roleOptions(roles.data)}
              value={value || null}
              onChange={onChange}
              onBlur={onBlur}
              aria-describedby={aria['aria-describedby']}
              aria-invalid={aria['aria-invalid']}
            />
          )}
        </FormField>

        <FormField
          control={form.control}
          name="experience"
          label="Years of experience"
          description="At least this many whole years of work."
        >
          {(field) => <Input {...field} value={field.value} type="number" min={0} step={1} />}
        </FormField>

        <FormField control={form.control} name="location" label="Location">
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
          control={form.control}
          name="languages"
          label="Languages"
          description="Every one of these, at the level you ask for or better."
        >
          {({ value, onChange, onBlur, id, ...aria }) => (
            <LanguageFilter
              id={id}
              value={value}
              onChange={onChange}
              onBlur={onBlur}
              aria-describedby={aria['aria-describedby']}
              aria-invalid={aria['aria-invalid']}
            />
          )}
        </FormField>

        {ranked ? (
          <FormField
            control={form.control}
            name="keywords"
            label="Words that must appear"
            description="Quoted phrases, or, and -excluded all work."
          >
            {(field) => <Input {...field} value={field.value} />}
          </FormField>
        ) : null}
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            form.reset(EMPTY);
            onSearch({ q: '' });
          }}
        >
          Clear
        </Button>
        <Button type="submit">
          <Search aria-hidden="true" />
          {ranked ? 'Search' : 'Apply filters'}
        </Button>
      </div>
    </form>
  );
}
