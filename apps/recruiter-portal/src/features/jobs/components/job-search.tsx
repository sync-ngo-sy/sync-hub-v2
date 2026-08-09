import { Input } from '@sync/ui/components/ui/input';
import { Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useDebouncedCallback } from 'use-debounce';

interface JobSearchProps {
  q?: string;
  onQueryChange: (q?: string) => void;
}

export function JobSearch({ q, onQueryChange }: JobSearchProps) {
  const [written, setWritten] = useState(q ?? '');
  const commit = useDebouncedCallback((value: string) => {
    onQueryChange(value.trim() || undefined);
  }, 300);

  useEffect(() => {
    setWritten(q ?? '');
  }, [q]);

  return (
    <div className="relative w-full sm:max-w-sm">
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        type="search"
        aria-label="Search jobs"
        placeholder="Search jobs"
        maxLength={200}
        value={written}
        className="pl-9"
        onChange={(event) => {
          const value = event.target.value;
          setWritten(value);
          commit(value);
        }}
      />
    </div>
  );
}
