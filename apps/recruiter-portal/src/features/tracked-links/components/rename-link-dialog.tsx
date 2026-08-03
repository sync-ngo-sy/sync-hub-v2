import { Dialog, DialogContent } from '@sync/ui/components/ui/dialog';
import { toast } from 'sonner';
import { useChangeTrackedLink } from '../hooks/use-tracked-link-actions';
import type { TrackedLink } from '../tracked-link';
import { LinkNameForm } from './link-name-form';

interface RenameLinkDialogProps {
  jobId: string;
  link: TrackedLink;
  onClose: () => void;
}

export function RenameLinkDialog({ jobId, link, onClose }: RenameLinkDialogProps) {
  const rename = useChangeTrackedLink(jobId);

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <LinkNameForm
          title="Rename tracked link"
          description="The address stays what it was, and so do the views it has already brought."
          defaultName={link.name}
          submitLabel="Save name"
          pendingLabel="Saving…"
          refusalTitle="Name not changed"
          refusalFallback="This link couldn't be renamed."
          onSubmit={async (name) => {
            await rename.mutateAsync({
              params: { path: { job_id: jobId, link_id: link.id } },
              body: { name },
            });
            toast.success('Tracked link renamed');
            onClose();
          }}
          onCancel={onClose}
        />
      </DialogContent>
    </Dialog>
  );
}
