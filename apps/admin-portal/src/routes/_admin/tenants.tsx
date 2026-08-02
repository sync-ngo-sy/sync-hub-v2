import { createFileRoute } from '@tanstack/react-router';
import { PlaceholderPage } from '@/features/shell/components/app-shell';

export const Route = createFileRoute('/_admin/tenants')({
  component: () => <PlaceholderPage title="Tenants" />,
});
