import { createRootRouteWithContext, Outlet } from '@tanstack/react-router';
import { AppToaster } from '../components/app-toaster';
import { RouteErrorFallback } from '../components/route-error-fallback';
import { Devtools } from '../lib/devtools';
import type { RouterContext } from '../lib/router-context';
import { ThemeProvider } from '../lib/theme';

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
  errorComponent: RouteErrorFallback,
});

// The app frame lives in the `_shell` layout, not here: the Editorial landing renders full-bleed
// with its own chrome, every other route inherits AppShell. ThemeProvider stays global so both
// register in either theme.
function RootComponent() {
  return (
    <ThemeProvider>
      <Outlet />
      <AppToaster />
      <Devtools />
    </ThemeProvider>
  );
}
