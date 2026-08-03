import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@sync/ui/components/ui/dialog';
import { SCOPE_LABELS, type Tag } from '../tag';
import { TagForm } from './tag-form';

interface RenameTagDialogProps {
  vocabulary: Tag[];
  tag: Tag;
  onClose: () => void;
}

export function RenameTagDialog({ vocabulary, tag, onClose }: RenameTagDialogProps) {
  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{`Rename “${tag.name}”`}</DialogTitle>
          <DialogDescription>
            {`Everything already filed under it stays filed, and it goes on ${SCOPE_LABELS[
              tag.scope
            ].toLocaleLowerCase()} as before.`}
          </DialogDescription>
        </DialogHeader>
        <TagForm vocabulary={vocabulary} tag={tag} onSaved={onClose} onCancel={onClose} />
      </DialogContent>
    </Dialog>
  );
}
