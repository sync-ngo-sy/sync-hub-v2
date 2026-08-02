import { setupServer } from 'msw/node';
import { respondsWithPlatformOverview } from '@/features/platform/testing/handlers';

export const server = setupServer(...respondsWithPlatformOverview());
