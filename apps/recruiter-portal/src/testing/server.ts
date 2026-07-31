import { setupServer } from 'msw/node';

/** One server for the whole suite; each test installs the handlers it needs. */
export const server = setupServer();
