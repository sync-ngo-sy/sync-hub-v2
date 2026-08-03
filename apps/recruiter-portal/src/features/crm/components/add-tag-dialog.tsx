import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@sync/ui/components/ui/dialog';
import type { Tag } from '../tag';
import { TagForm } from './tag-form';

interface AddTagDialogProps {
  vocabulary: Tag[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddTagDialog({ vocabulary, open, onOpenChange }: AddTagDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add a Tag</DialogTitle>
          <DialogDescription>
            A word your team files by. It is your Tenant's alone, and what it may be put on is fixed
            when you add it.
          </DialogDescription>
        </DialogHeader>
        <TagForm
          vocabulary={vocabulary}
          onSaved={() => onOpenChange(false)}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
