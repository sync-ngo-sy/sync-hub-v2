// PROTOTYPE for #369 — throwaway. CHOSEN.
//
// A — Ask when it lands. Nothing moves until the Candidate answers. The parse arriving raises one
// modal over the page; closing it, or leaving, keeps what they typed. Nothing is remembered, so
// every CV asks. The standing banner is gone and Undo lives on the save bar. Every read CV keeps
// its own "Update your profile from this CV" button, so saying no now is not saying no forever.

import { TruncatedText } from '@sync/ui/components/truncated-text';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@sync/ui/components/ui/alert-dialog';
import { Button } from '@sync/ui/components/ui/button';
import { Undo2 } from 'lucide-react';
import { SAVE_BAR, type VariantProps } from './variant';

export const NAME = 'Ask when it lands';

export function VariantA({
  update,
  cvs,
  card,
  fields,
  onSubmit,
  isDirty,
  isSubmitting,
}: VariantProps) {
  const { asking, cvName, updatedBy } = update.state;

  return (
    <>
      {cvs()}
      {card}

      <form onSubmit={onSubmit} noValidate className="space-y-6">
        {fields}

        <div className={SAVE_BAR}>
          <div className="min-w-0" aria-live="polite">
            {updatedBy ? (
              <>
                <p className="text-dense text-foreground">
                  The fields now say what <span className="font-medium">{updatedBy}</span> says.
                </p>
                <p className="text-meta text-muted-foreground">Nothing is saved yet.</p>
              </>
            ) : (
              <p className="text-dense text-muted-foreground">
                {isDirty ? 'Unsaved changes.' : 'Everything is saved.'}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {updatedBy ? (
              <Button type="button" variant="outline" onClick={update.undo}>
                <Undo2 aria-hidden="true" />
                Undo the update
              </Button>
            ) : null}
            {isDirty || isSubmitting ? (
              <Button type="submit" size="lg" disabled={isSubmitting}>
                {isSubmitting ? 'Saving…' : 'Save profile'}
              </Button>
            ) : null}
          </div>
        </div>
      </form>

      <AlertDialog
        open={asking}
        onOpenChange={(open) => {
          if (!open) update.dismiss();
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Update your profile from this CV?</AlertDialogTitle>
            <AlertDialogDescription>
              <TruncatedText className="mb-1 font-medium text-foreground">
                {cvName ?? ''}
              </TruncatedText>
              We have read it. Your Experience, Education, Languages, Projects and Links can say
              what it says, in place of what is there now. Skills you have listed keep their years.
              Nothing is saved either way until you press Save profile, and this CV can update your
              profile later if you say no now.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => update.reply('keep')}>
              Keep what I have
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => update.reply('update')}>
              Update from this CV
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
