import type { QueryClient } from '@tanstack/react-query';
import { createRootRouteWithContext, HeadContent, Outlet } from '@tanstack/react-router';
import { Toaster } from '@/features/shell/components/toaster';
import { ThemeProvider } from '@/lib/theme';

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({ meta: [{ title: 'Sync Platform' }] }),
  component: () => (
    <ThemeProvider>
      <HeadContent />
      <Outlet />
      <Toaster />
    </ThemeProvider>
  ),
});
