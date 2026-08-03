import { createFileRoute } from '@tanstack/react-router';
import { WidgetBoundary } from '@/features/shell/components/widget-boundary';
import { MessageTemplatesPage } from '@/features/templates/components/message-templates-page';
import { warmMessageTemplates } from '@/features/templates/hooks/use-message-templates';
import { pageTitle } from '@/lib/page-title';

export const Route = createFileRoute('/_workspace/templates')({
  loader: ({ context }) => warmMessageTemplates(context.queryClient),
  head: () => ({ meta: [{ title: pageTitle('Templates') }] }),
  component: TemplatesPage,
});

function TemplatesPage() {
  return (
    <WidgetBoundary name="Templates">
      <MessageTemplatesPage />
    </WidgetBoundary>
  );
}
