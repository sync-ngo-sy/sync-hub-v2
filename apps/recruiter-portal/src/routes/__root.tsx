import { ThemeProvider } from '@sync/ui/providers/theme';
import type { QueryClient } from '@tanstack/react-query';
import { createRootRouteWithContext, HeadContent, Outlet } from '@tanstack/react-router';
import { Toaster } from 'sonner';
import { Devtools } from '@/features/shell/components/devtools';
import { AppCrash } from '@/features/shell/components/route-error';
import { PORTAL_TITLE } from '@/lib/page-title';
import { THEME_STORAGE_KEY } from '@/lib/theme';

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({ meta: [{ title: PORTAL_TITLE }] }),
  component: RootLayout,
  errorComponent: AppCrash,
});

function RootLayout() {
  return (
    <ThemeProvider storageKey={THEME_STORAGE_KEY}>
      <HeadContent />
      <Outlet />
      <Toaster position="bottom-right" closeButton />
      <Devtools />
    </ThemeProvider>
  );
}
