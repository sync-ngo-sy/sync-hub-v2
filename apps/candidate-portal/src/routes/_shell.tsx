import { createFileRoute, Outlet } from '@tanstack/react-router';
import { AppShell } from '../components/app-shell';

// The app frame (logo, theme toggle, account menu) wraps every route except the public Editorial
// landing, which carries its own nav and footer.
export const Route = createFileRoute('/_shell')({
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
});
