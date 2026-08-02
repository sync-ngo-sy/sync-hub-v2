import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/app.css';
import { createQueryClient } from '@/lib/query-client';
import { createAppRouter } from '@/lib/router';

const root = document.getElementById('root');
if (!root) throw new Error('Root element #root not found');
const queryClient = createQueryClient();
const router = createAppRouter(queryClient);

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
