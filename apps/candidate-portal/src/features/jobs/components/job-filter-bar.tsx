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
  isFiltered,
  type JobFilters,
  MAX_KEYWORDS,
  NO_FILTERS,
} from '../filters';
import { EMPLOYMENT_TYPE_LABELS } from '../job';

/** Filtering by nothing is a choice on the list rather than a blank the reader has to guess at,
 * and it leads: the whole set is what an unfiltered Browse shows. */
const EMPLOYMENT_TYPES = { '': 'Any type', ...EMPLOYMENT_TYPE_LABELS };

interface JobFilterBarProps {
  filters: JobFilters;
  onChange: (filters: JobFilters) => void;
}

/**
 * The three filters the API takes, over the list they narrow. One form, so whichever control a
 * Candidate reaches for last carries the keyword already in the box — a bar that reads one way
 * while the list underneath answers another is worse than no bar at all.
 *
 * Full-width and stacked until there is room for a row: on a phone every control sits under the
 * thumb, and the keyboard's own search key runs it without reaching for a button.
 */
export function JobFilterBar({ filters, onChange }: JobFilterBarProps) {
  const places = useLocations();
  const [typed, setTyped] = useState(filters.q ?? '');
  const [applied, setApplied] = useState(filters.q);

  // The address can move without the box: filters cleared, a link pasted, the way back taken.
  // When it does the box follows, rather than holding a word that is no longer being searched.
  if (filters.q !== applied) {
    setApplied(filters.q);
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
              maxLength={MAX_KEYWORDS}
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
