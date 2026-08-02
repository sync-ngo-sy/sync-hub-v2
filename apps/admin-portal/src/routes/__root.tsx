import type { QueryClient } from '@tanstack/react-query';
import { createRootRouteWithContext, HeadContent, Outlet } from '@tanstack/react-router';
import { Toaster } from 'sonner';
import { ThemeProvider } from '@/lib/theme';

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({ meta: [{ title: 'Sync Platform' }] }),
  component: () => (
    <ThemeProvider>
      <HeadContent />
      <Outlet />
      <Toaster position="bottom-right" />
    </ThemeProvider>
  ),
});
