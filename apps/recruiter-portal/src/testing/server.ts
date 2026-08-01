import { setupServer } from 'msw/node';
import { listsJobs } from '@/features/jobs/testing/handlers';

export const server = setupServer(...listsJobs([]));
