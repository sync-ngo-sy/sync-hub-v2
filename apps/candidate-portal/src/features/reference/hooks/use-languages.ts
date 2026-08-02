import { useQuery } from '@tanstack/react-query';
import { languagesQuery } from '../reference-queries';

/** Every language the platform knows, fetched whole and filtered in the browser. */
export function useLanguages() {
  return useQuery(languagesQuery);
}
