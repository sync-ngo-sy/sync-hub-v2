import { Alert, AlertDescription, AlertTitle } from '@sync/ui/components/ui/alert';
import { Button } from '@sync/ui/components/ui/button';
import { Undo2, Wand2 } from 'lucide-react';

interface FilledNoticeProps {
  cvName: string;
  onUndo: () => void;
  onDismiss: () => void;
}

/**
 * What replaced the review dialog. The dialog summarised edits to a form the reader could not
 * see; this says which CV spoke, leaves the reading to the fields themselves, and keeps one way
 * back — which is the whole safety net for a profile that was written by hand.
 */
export function FilledNotice({ cvName, onUndo, onDismiss }: FilledNoticeProps) {
  return (
    <Alert>
      <Wand2 aria-hidden="true" />
      <AlertTitle>The fields below now say what “{cvName}” says</AlertTitle>
      <AlertDescription>
        Nothing has been saved. Change anything that is not right, then press Save profile.
      </AlertDescription>
      <div className="mt-2 flex flex-wrap gap-2 group-has-[>svg]/alert:col-start-2">
        <Button type="button" variant="outline" size="sm" onClick={onUndo}>
          <Undo2 aria-hidden="true" />
          Undo the fill
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onDismiss}>
          Keep it
        </Button>
      </div>
    </Alert>
  );
}
