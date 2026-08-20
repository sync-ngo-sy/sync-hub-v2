import { TruncatedText } from '@sync/ui/components/truncated-text';
import { Alert, AlertDescription, AlertTitle } from '@sync/ui/components/ui/alert';
import { Button } from '@sync/ui/components/ui/button';
import { Undo2, Wand2 } from 'lucide-react';

interface UpdateQuestionProps {
  cvName: string;
  onUndo: () => void;
  onDismiss: () => void;
}

export function UpdateQuestion({ cvName, onUndo, onDismiss }: UpdateQuestionProps) {
  return (
    <Alert>
      <Wand2 aria-hidden="true" />
      <AlertTitle>The fields below now say what your CV says</AlertTitle>
      <AlertDescription>
        <TruncatedText className="mb-1 font-medium text-foreground">{cvName}</TruncatedText>
        Nothing has been saved. Change anything that is not right, then press Save profile.
      </AlertDescription>
      <div className="mt-2 flex flex-wrap gap-2 group-has-[>svg]/alert:col-start-2">
        <Button type="button" variant="outline" size="sm" onClick={onUndo}>
          <Undo2 aria-hidden="true" />
          Undo the update
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onDismiss}>
          Keep it
        </Button>
      </div>
    </Alert>
  );
}
