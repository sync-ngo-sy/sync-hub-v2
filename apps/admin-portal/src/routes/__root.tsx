import { ThemeProvider } from '@sync/ui/providers/theme';
import type { QueryClient } from '@tanstack/react-query';
import { createRootRouteWithContext, HeadContent, Outlet } from '@tanstack/react-router';
import { Toaster } from '@/features/shell/components/toaster';
import { THEME_STORAGE_KEY } from '@/lib/theme';

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({ meta: [{ title: 'Sync Platform' }] }),
  component: () => (
    <ThemeProvider storageKey={THEME_STORAGE_KEY}>
      <HeadContent />
      <Outlet />
      <Toaster />
    </ThemeProvider>
  ),
});
