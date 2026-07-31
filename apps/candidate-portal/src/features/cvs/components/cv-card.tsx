import { Button } from '@sync/ui/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@sync/ui/components/ui/card';
import { CircleCheck, Download, FileText, Star, Trash2 } from 'lucide-react';
import { formatRelative } from '../format';
import { useCvDownload } from '../hooks/use-cv-download';
import { type Cv, isReady } from '../status';
import { ParseStatus } from './parse-status';

interface CvCardProps {
  cv: Cv;
  onReview: (cv: Cv) => void;
  onMakeCurrent: (cv: Cv) => void;
  onDelete: (cv: Cv) => void;
}

export function CvCard({ cv, onReview, onMakeCurrent, onDelete }: CvCardProps) {
  const { download, mutation: downloadMutation } = useCvDownload();
  const ready = isReady(cv);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText aria-hidden className="size-4 text-muted-foreground" />
          {cv.display_name}
        </CardTitle>
        {cv.is_current ? (
          <CardAction>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground">
              <CircleCheck aria-hidden className="size-3.5" />
              Current CV
            </span>
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-2">
        <ParseStatus cv={cv} />
        <p className="text-sm text-muted-foreground">Added {formatRelative(cv.created_at)}</p>
      </CardContent>
      <CardFooter className="flex-wrap gap-2">
        {ready && !cv.is_current ? (
          <Button variant="outline" size="sm" onClick={() => onMakeCurrent(cv)}>
            <Star aria-hidden />
            Make current
          </Button>
        ) : null}
        {ready ? (
          <Button variant="outline" size="sm" onClick={() => onReview(cv)}>
            Review draft
          </Button>
        ) : null}
        <Button
          variant="outline"
          size="sm"
          disabled={downloadMutation.isPending}
          onClick={() => void download(cv.id)}
        >
          <Download aria-hidden />
          Download
        </Button>
        <Button variant="destructive" size="sm" className="ml-auto" onClick={() => onDelete(cv)}>
          <Trash2 aria-hidden />
          Delete
        </Button>
      </CardFooter>
    </Card>
  );
}
