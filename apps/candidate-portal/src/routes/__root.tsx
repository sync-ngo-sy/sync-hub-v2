import type { QueryClient } from '@tanstack/react-query';
import { createRootRouteWithContext, HeadContent, Outlet } from '@tanstack/react-router';
import { Devtools } from '@/features/shell/components/devtools';
import { AppCrash } from '@/features/shell/components/route-error';
import { Toaster } from '@/features/shell/components/toaster';
import { PORTAL_TITLE } from '@/lib/page-title';
import { ThemeProvider } from '@/lib/theme';

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({ meta: [{ title: PORTAL_TITLE }] }),
  component: RootLayout,
  errorComponent: AppCrash,
});

function RootLayout() {
  return (
    <ThemeProvider>
      <HeadContent />
      <Outlet />
      <Toaster />
      <Devtools />
    </ThemeProvider>
  );
}
