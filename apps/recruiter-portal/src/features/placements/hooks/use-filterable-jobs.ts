import { useState } from 'react';
import type { FilterableJob } from '../placement';

/** The Jobs the Job filter can name, held across a reread.
 *
 * They are the same whichever claim is being read, so they are not this page of claims: a
 * picker whose options went away while its own choice was loading would unpick itself.
 */
export function useFilterableJobs(read: FilterableJob[] | undefined): FilterableJob[] {
  const [known, setKnown] = useState<FilterableJob[]>([]);
  if (read !== undefined && read !== known) setKnown(read);
  return read ?? known;
}
