import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@sync/ui/globals.css';
import { queryClient } from './lib/query-client';
import { createAppRouter } from './lib/router';
import { ThemeProvider } from './lib/theme';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element #root not found');

const router = createAppRouter(queryClient);

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <RouterProvider router={router} />
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
);
