import { zodResolver } from '@hookform/resolvers/zod';
import { FormField } from '@sync/ui/components/form-field';
import { Button } from '@sync/ui/components/ui/button';
import { Input } from '@sync/ui/components/ui/input';
import { Search } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { ReferencePicker } from '@/features/reference/components/reference-picker';
import { useLanguages } from '@/features/reference/hooks/use-languages';
import { useLocations } from '@/features/reference/hooks/use-locations';
import { languageOptions, locationGroups } from '@/features/reference/options';
import { type CandidateSearchValues, candidateSearchSchema } from '../schemas/candidate-search';
import type { CandidateSearchFilters } from '../search';

interface CandidateFiltersProps {
  filters: CandidateSearchFilters;
  onSearch: (filters: CandidateSearchFilters) => void;
}

function values(filters: CandidateSearchFilters): CandidateSearchValues {
  return {
    q: filters.q,
    location: filters.location ?? '',
    language: filters.language ?? '',
    keywords: filters.keywords ?? '',
  };
}

export function CandidateFilters({ filters, onSearch }: CandidateFiltersProps) {
  const places = useLocations();
  const languages = useLanguages();
  const form = useForm<CandidateSearchValues>({
    resolver: zodResolver(candidateSearchSchema),
    values: values(filters),
  });

  const search = form.handleSubmit((asked) => onSearch(asked));

  return (
    <form onSubmit={search} noValidate aria-label="Candidate search" className="space-y-4">
      <FormField
        control={form.control}
        name="q"
        label="Who are you looking for?"
        description="Plain words. The search reads what they mean, not just the letters in them."
      >
        {(field) => <Input {...field} value={field.value} autoFocus />}
      </FormField>

      <div className="grid gap-4 sm:grid-cols-3">
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

        <FormField control={form.control} name="language" label="Preferred language">
          {({ value, onChange, onBlur, id, ...aria }) => (
            <ReferencePicker
              id={id}
              noun="language"
              list={languages}
              options={languageOptions(languages.data)}
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
          name="keywords"
          label="Words that must appear"
          description="Quoted phrases, or, and -excluded all work."
        >
          {(field) => <Input {...field} value={field.value} />}
        </FormField>
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            form.reset({ q: '', location: '', language: '', keywords: '' });
            onSearch({ q: '' });
          }}
        >
          Clear
        </Button>
        <Button type="submit">
          <Search aria-hidden="true" />
          Search
        </Button>
      </div>
    </form>
  );
}
