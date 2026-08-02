import { createFileRoute } from '@tanstack/react-router';
import { PlaceholderPage } from '@/features/shell/components/app-shell';

export const Route = createFileRoute('/_admin/overview')({
  component: () => <PlaceholderPage title="Platform overview" />,
});
