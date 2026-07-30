import type { QueryClient } from '@tanstack/react-query';
import { createRootRouteWithContext, HeadContent, Outlet } from '@tanstack/react-router';
import { Toaster } from 'sonner';
import { Devtools } from '@/features/shell/components/devtools';
import { AppCrash } from '@/features/shell/components/route-error';

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({ meta: [{ title: 'Sync Recruiter' }] }),
  component: RootLayout,
  errorComponent: AppCrash,
});

function RootLayout() {
  return (
    <>
      <HeadContent />
      <Outlet />
      <Toaster position="bottom-right" closeButton />
      <Devtools />
    </>
  );
}
