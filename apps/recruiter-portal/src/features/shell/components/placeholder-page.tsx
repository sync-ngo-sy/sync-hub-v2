import { Card, CardContent } from '@sync/ui/components/ui/card';
import { PageHeader } from './page-header';

/** Every destination the shell routes to, until its own ticket fills the page in. */
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
