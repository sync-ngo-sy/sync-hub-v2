import { createRootRouteWithContext, Outlet } from '@tanstack/react-router';
import { AppShell } from '../components/app-shell';
import { AppToaster } from '../components/app-toaster';
import { RouteErrorFallback } from '../components/route-error-fallback';
import { Devtools } from '../lib/devtools';
import type { RouterContext } from '../lib/router-context';
import { ThemeProvider } from '../lib/theme';

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
  errorComponent: RouteErrorFallback,
});

function RootComponent() {
  return (
    <ThemeProvider>
      <AppShell>
        <Outlet />
      </AppShell>
      <AppToaster />
      <Devtools />
    </ThemeProvider>
  );
}
