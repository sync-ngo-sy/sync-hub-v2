import '@sync/ui/globals.css';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ErrorBoundary } from 'react-error-boundary';
import { AppShellErrorFallback } from './components/app-shell-error-fallback';
import { reportError } from './lib/report-error';
import { queryClient, router } from './lib/router';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element #root not found');

createRoot(rootElement).render(
  <StrictMode>
    <ErrorBoundary
      FallbackComponent={AppShellErrorFallback}
      onError={(error) => reportError(error, { boundary: 'app-shell' })}
    >
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
);
