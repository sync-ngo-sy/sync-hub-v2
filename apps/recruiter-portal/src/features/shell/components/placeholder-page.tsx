import { Card, CardContent } from '@sync/ui/components/ui/card';
import { PageHeader } from './page-header';

export function PlaceholderPage({ title }: { title: string }) {
  return (
    <>
      <PageHeader title={title} />
      <Card>
        <CardContent className="py-10 text-center text-dense text-muted-foreground">
          {title} arrives with its own ticket.
        </CardContent>
      </Card>
    </>
  );
}
