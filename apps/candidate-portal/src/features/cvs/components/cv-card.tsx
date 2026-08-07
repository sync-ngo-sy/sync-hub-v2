import { StatusChip } from '@sync/ui/components/status-chip';
import { Alert, AlertDescription, AlertTitle } from '@sync/ui/components/ui/alert';
import { Button } from '@sync/ui/components/ui/button';
import { CircleX, Download, Star, Trash2, Wand2 } from 'lucide-react';
import { useId, useState } from 'react';
import { toast } from 'sonner';
import { problemMessage } from '@/lib/api-problem';
import { absoluteDateTime, relativeTime } from '@/lib/dates';
import { type Cv, hasFailed, isReady, languageName, PARSE_STATES } from '../cv';
import { useCvDownloadLink, useDeleteCv, useMakeCvCurrent } from '../hooks/use-cv-actions';
import { ConfirmDialog } from './confirm-dialog';

interface CvCardProps {
  cv: Cv;
  onFill: (cv: Cv) => void;
  filling: boolean;
}

export function CvCard({ cv, onFill, filling }: CvCardProps) {
  const makeCurrent = useMakeCvCurrent();
  const remove = useDeleteCv();
  const downloadLink = useCvDownloadLink();
  const [confirming, setConfirming] = useState<'current' | 'delete' | null>(null);

  const state = PARSE_STATES[cv.parsing_status];
  const ready = isReady(cv);
  const undeletableId = useId();

  async function download() {
    const tab = window.open('', '_blank');
    if (tab) tab.opener = null;
    try {
      const link = await downloadLink.mutateAsync(cv.id);
      if (tab) tab.location.href = link.url;
      else window.location.href = link.url;
    } catch (error) {
      tab?.close();
      toast.error(problemMessage(error, "Couldn't get a link to that file. Try again."));
    }
  }

  async function switchCurrent() {
    try {
      await makeCurrent.mutateAsync({ params: { path: { cv_id: cv.id } } });
      setConfirming(null);
      toast.success(`“${cv.display_name}” is now the CV you apply with.`);
    } catch (error) {
      toast.error(problemMessage(error, "Couldn't make that CV current. Try again."));
    }
  }

  async function destroy() {
    try {
      await remove.mutateAsync({ params: { path: { cv_id: cv.id } } });
      setConfirming(null);
      toast.success(`“${cv.display_name}” deleted.`);
    } catch (error) {
      toast.error(problemMessage(error, "Couldn't delete that CV. Try again."));
    }
  }

  return (
    <div className="min-w-0 space-y-4 rounded-lg border border-border p-3 md:p-4">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-heading text-base font-medium text-foreground">{cv.display_name}</h3>
          {cv.is_current ? <StatusChip tone="positive" label="Current" /> : null}
          <StatusChip tone={state.tone} label={state.label} />
        </div>

        <p className="text-meta text-muted-foreground">
          Uploaded{' '}
          <time dateTime={cv.created_at} title={absoluteDateTime(cv.created_at)}>
            {relativeTime(cv.created_at)}
          </time>
          {cv.detected_language ? ` · Written in ${languageName(cv.detected_language)}` : ''}
        </p>

        <p className="text-dense text-muted-foreground">{state.sentence}</p>
      </div>

      {hasFailed(cv) && cv.parsing_error ? (
        <Alert className="bg-muted">
          <CircleX aria-hidden="true" />
          <AlertTitle>Why it could not be read</AlertTitle>
          <AlertDescription>{cv.parsing_error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {ready && !cv.is_current ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label={`Make “${cv.display_name}” current`}
            onClick={() => setConfirming('current')}
          >
            <Star aria-hidden="true" />
            Make current
          </Button>
        ) : null}

        {ready ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={filling}
            aria-label={`Fill the form from “${cv.display_name}”`}
            onClick={() => onFill(cv)}
          >
            <Wand2 aria-hidden="true" />
            {filling ? 'Filling…' : 'Fill the form from this CV'}
          </Button>
        ) : null}

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={downloadLink.isPending}
          aria-label={`Download “${cv.display_name}”`}
          onClick={download}
        >
          <Download aria-hidden="true" />
          {downloadLink.isPending ? 'Preparing…' : 'Download'}
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={cv.is_current}
          aria-describedby={cv.is_current ? undeletableId : undefined}
          aria-label={`Delete “${cv.display_name}”`}
          onClick={() => setConfirming('delete')}
        >
          <Trash2 aria-hidden="true" />
          Delete
        </Button>
      </div>

      {cv.is_current ? (
        <p id={undeletableId} className="text-meta text-muted-foreground">
          The current CV cannot be deleted. Make another one current first.
        </p>
      ) : null}

      <ConfirmDialog
        open={confirming === 'current'}
        onOpenChange={(open) => setConfirming(open ? 'current' : null)}
        title={`Apply with “${cv.display_name}” from now on?`}
        description="The current CV is the one sent with every new application, and the one recruiters searching the platform find you by. Applications you have already sent keep the CV they went out with."
        confirmLabel="Make it current"
        pendingLabel="Switching…"
        pending={makeCurrent.isPending}
        onConfirm={switchCurrent}
      />

      <ConfirmDialog
        open={confirming === 'delete'}
        onOpenChange={(open) => setConfirming(open ? 'delete' : null)}
        title={`Delete “${cv.display_name}”?`}
        description="This frees a slot and lets you upload the same file again. Recruiters reviewing an application you sent with it can still read it."
        confirmLabel="Delete"
        pendingLabel="Deleting…"
        pending={remove.isPending}
        destructive
        onConfirm={destroy}
      />
    </div>
  );
}
