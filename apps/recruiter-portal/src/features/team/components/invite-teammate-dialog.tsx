import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@sync/ui/components/ui/dialog';
import { InviteTeammateForm } from './invite-teammate-form';

interface InviteTeammateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InviteTeammateDialog({ open, onOpenChange }: InviteTeammateDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Invite a teammate</DialogTitle>
          <DialogDescription>
            Sync Hub emails them an invitation. They choose their own password, and join your Tenant
            once they have.
          </DialogDescription>
        </DialogHeader>
        <InviteTeammateForm
          onSent={() => onOpenChange(false)}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
