import { useQuery } from '@tanstack/react-query';
import { canonicalSkillsQuery } from '../reference-queries';

/** Every Canonical skill the platform has, fetched whole and filtered in the browser. */
export function useCanonicalSkills() {
  return useQuery(canonicalSkillsQuery);
}
