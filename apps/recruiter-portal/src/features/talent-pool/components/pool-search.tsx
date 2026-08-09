import { FormField } from '@sync/ui/components/form-field';
import { Button } from '@sync/ui/components/ui/button';
import { Input } from '@sync/ui/components/ui/input';
import { Search } from 'lucide-react';
import { useForm } from 'react-hook-form';

const LABEL = 'Search your talent pool';

const HINT = 'Matched against names and headlines. It never reaches outside your pool.';

interface PoolSearchProps {
  q: string;
  onSearch: (q: string) => void;
}

export function PoolSearch({ q, onSearch }: PoolSearchProps) {
  const form = useForm<{ q: string }>({ values: { q } });

  return (
    <form
      aria-label={LABEL}
      noValidate
      onSubmit={form.handleSubmit((written) => onSearch(written.q))}
    >
      <FormField
        control={form.control}
        name="q"
        label={LABEL}
        description={HINT}
        className="max-w-xl"
      >
        {(field) => (
          <div className="flex gap-2">
            <Input {...field} value={field.value} type="search" />
            <Button type="submit" variant="outline">
              <Search aria-hidden="true" />
              Search
            </Button>
          </div>
        )}
      </FormField>
    </form>
  );
}
