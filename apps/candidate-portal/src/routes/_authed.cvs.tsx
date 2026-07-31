import { PageHeader } from '@sync/ui/components/page-header';
import { CardSkeleton } from '@sync/ui/components/skeletons';
import { Button } from '@sync/ui/components/ui/button';
import { Card, CardContent } from '@sync/ui/components/ui/card';
import { createFileRoute } from '@tanstack/react-router';
import { AlertCircle } from 'lucide-react';
import { CvList } from '../features/cvs/components/cv-list';
import { CvUploader } from '../features/cvs/components/cv-uploader';
import { useCvs } from '../features/cvs/hooks/use-cvs';

export const Route = createFileRoute('/_authed/cvs')({
  component: CvsPage,
});

function CvsPage() {
  const cvsQuery = useCvs();

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-8">
      <PageHeader
        title="CVs"
        description="Keep up to five CVs, choose which one employers see, and download any of them."
      />
      {cvsQuery.isPending ? (
        <div className="space-y-4">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : cvsQuery.isError ? (
        <Card className="border-dashed">
          <CardContent className="flex items-center justify-between gap-3 text-sm">
            <span className="flex items-center gap-2 text-muted-foreground">
              <AlertCircle aria-hidden className="size-4" />
              We couldn't load your CVs.
            </span>
            <Button variant="outline" size="sm" onClick={() => void cvsQuery.refetch()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <CvUploader cvCount={cvsQuery.data.length} />
          <CvList cvs={cvsQuery.data} />
        </>
      )}
    </div>
  );
}
