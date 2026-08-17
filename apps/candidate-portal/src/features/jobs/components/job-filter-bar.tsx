import { Button } from '@sync/ui/components/ui/button';
import { Input } from '@sync/ui/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@sync/ui/components/ui/select';
import { useState } from 'react';
import { ReferencePicker } from '@/features/reference/components/reference-picker';
import { useLocations } from '@/features/reference/hooks/use-locations';
import { locationGroups } from '@/features/reference/options';
import {
  asEmploymentType,
  asWorkMode,
  isFiltered,
  type JobFilters,
  MAX_KEYWORD_LENGTH,
  NO_FILTERS,
} from '../filters';
import { EMPLOYMENT_TYPE_LABELS, WORK_MODE_LABELS } from '../job';

const EMPLOYMENT_TYPES = { '': 'Any type', ...EMPLOYMENT_TYPE_LABELS };
const WORK_MODES = { '': 'Any work mode', ...WORK_MODE_LABELS };

const appliedFilters = (filters: JobFilters) =>
  JSON.stringify([filters.q, filters.location, filters.type, filters.mode]);

interface JobFilterBarProps {
  filters: JobFilters;
  onChange: (filters: JobFilters) => void;
}

export function JobFilterBar({ filters, onChange }: JobFilterBarProps) {
  const places = useLocations();
  const [typed, setTyped] = useState(filters.q ?? '');
  const [applied, setApplied] = useState(() => appliedFilters(filters));

  const current = appliedFilters(filters);
  if (current !== applied) {
    setApplied(current);
    setTyped(filters.q ?? '');
  }

  const commit = (changed: Partial<JobFilters>) => {
    const keywords = typed.trim();
    onChange({ ...filters, q: keywords || undefined, ...changed });
  };

  return (
    <search aria-label="Filter jobs">
      <form
        className="space-y-2"
        onSubmit={(event) => {
          event.preventDefault();
          commit({});
        }}
      >
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="flex gap-2 sm:flex-1">
            <Input
              type="search"
              enterKeyHint="search"
              maxLength={MAX_KEYWORD_LENGTH}
              aria-label="Search jobs"
              placeholder="Job title or keyword"
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
            />
            <Button type="submit" variant="outline" className="shrink-0">
              Search
            </Button>
          </div>

          <ReferencePicker
            className="sm:w-52"
            aria-label="Location"
            placeholder="Any location"
            noun="location"
            list={places}
            options={locationGroups(places.data)}
            value={filters.location ?? null}
            onChange={(location) => commit({ location: location || undefined })}
          />

          <Select
            items={WORK_MODES}
            value={filters.mode ?? ''}
            onValueChange={(chosen: string | null) => commit({ mode: asWorkMode(chosen) })}
          >
            <SelectTrigger aria-label="Work mode" className="w-full sm:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(WORK_MODES).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            items={EMPLOYMENT_TYPES}
            value={filters.type ?? ''}
            onValueChange={(chosen: string | null) => commit({ type: asEmploymentType(chosen) })}
          >
            <SelectTrigger aria-label="Employment type" className="w-full sm:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(EMPLOYMENT_TYPES).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isFiltered(filters) ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(NO_FILTERS)}>
            Clear filters
          </Button>
        ) : null}
      </form>
    </search>
  );
}
