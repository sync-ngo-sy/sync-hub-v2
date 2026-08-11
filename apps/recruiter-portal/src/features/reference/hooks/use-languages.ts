import { api } from '@/lib/api';
import { REFERENCE_CACHE } from '../reference-queries';

export function useLanguages() {
  return api.useQuery('get', '/v1/languages', undefined, REFERENCE_CACHE);
}

export function useLanguageName() {
  const { data: languages } = useLanguages();
  return (code: string) =>
    languages?.find((language) => language.code === code)?.name ?? code.toUpperCase();
}
