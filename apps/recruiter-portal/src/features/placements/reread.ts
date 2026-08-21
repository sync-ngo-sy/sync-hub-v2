import { useQueryClient } from '@tanstack/react-query';
import type { HireConfirmation } from './placement';

export const HIRE_CLAIMS_PATH = '/v1/tenants/me/hire-claims';

export const HIRE_CLAIMS_PAGE_SIZE = 20;

export function hireClaimsPage(tab: HireConfirmation) {
  return { params: { query: { confirmation: tab, limit: HIRE_CLAIMS_PAGE_SIZE } } };
}

function everyHireClaimsReading() {
  return ['get', HIRE_CLAIMS_PATH] as const;
}

export function useRereadHireClaims() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: everyHireClaimsReading() });
}
