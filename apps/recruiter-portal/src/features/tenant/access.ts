import type { QueryClient } from '@tanstack/react-query';
import { myTenantQuery } from './hooks/use-my-tenant';
import { type AccessRefusal, accessRefusal } from './refusal';

export async function askTenantAccess(queryClient: QueryClient): Promise<AccessRefusal | null> {
  try {
    await queryClient.fetchQuery({ ...myTenantQuery(), staleTime: 0 });
    return null;
  } catch (error) {
    return accessRefusal(error);
  }
}
