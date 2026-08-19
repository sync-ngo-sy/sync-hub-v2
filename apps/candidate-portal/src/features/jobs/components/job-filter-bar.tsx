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

interface ChosenFromProps {
  label: string;
  items: Record<string, string>;
  width: string;
  value: string;
  onChosen: (chosen: string | null) => void;
}

function ChosenFrom({ label, items, width, value, onChosen }: ChosenFromProps) {
  return (
    <Select items={items} value={value} onValueChange={onChosen}>
      <SelectTrigger aria-label={label} className={`w-full ${width}`}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {Object.entries(items).map(([itemValue, itemLabel]) => (
          <SelectItem key={itemValue} value={itemValue}>
            {itemLabel}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

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

          <ChosenFrom
            label="Work mode"
            items={WORK_MODES}
            width="sm:w-44"
            value={filters.mode ?? ''}
            onChosen={(chosen) => commit({ mode: asWorkMode(chosen) })}
          />

          <ChosenFrom
            label="Employment type"
            items={EMPLOYMENT_TYPES}
            width="sm:w-40"
            value={filters.type ?? ''}
            onChosen={(chosen) => commit({ type: asEmploymentType(chosen) })}
          />
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
