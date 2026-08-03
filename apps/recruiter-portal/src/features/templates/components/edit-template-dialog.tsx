import { SkeletonText } from '@sync/ui/components/skeletons';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@sync/ui/components/ui/dialog';
import { useMessageTemplate } from '../hooks/use-message-template';
import { MessageTemplateForm } from './message-template-form';

interface EditTemplateDialogProps {
  templateId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditTemplateDialog({ templateId, open, onOpenChange }: EditTemplateDialogProps) {
  const template = useMessageTemplate(templateId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Edit Message template</DialogTitle>
          <DialogDescription>
            Saving rewrites all of it. Messages already sent keep the words they were sent with.
          </DialogDescription>
        </DialogHeader>

        {template.isPending ? (
          <div role="status" aria-label="Loading Message template" className="py-4">
            <SkeletonText lines={5} />
          </div>
        ) : null}

        {template.data ? (
          <MessageTemplateForm
            template={template.data}
            onSaved={() => onOpenChange(false)}
            onCancel={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
