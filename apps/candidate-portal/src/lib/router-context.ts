import type { Api, ApiFetchClient } from '@sync/api-client';
import type { QueryClient } from '@tanstack/react-query';

export interface RouterContext {
  queryClient: QueryClient;
  api: Api;
  client: ApiFetchClient;
}
