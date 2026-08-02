import { setupServer } from 'msw/node';
import {
  respondsWithPlatformOverview,
  respondsWithPlatformTenants,
} from '@/features/platform/testing/handlers';

export const server = setupServer(
  ...respondsWithPlatformOverview(),
  ...respondsWithPlatformTenants(),
);
