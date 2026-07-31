import { PageHeader } from '@sync/ui/components/page-header';
import { Card, CardContent } from '@sync/ui/components/ui/card';

export function PlaceholderPage({ title, description }: { title: string; description?: string }) {
  return (
    <div className="space-y-8">
      <PageHeader title={title} description={description} />
      <Card>
        <CardContent className="py-10 text-center text-dense text-muted-foreground">
          {title} arrives with its own ticket.
        </CardContent>
      </Card>
    </div>
  );
}
