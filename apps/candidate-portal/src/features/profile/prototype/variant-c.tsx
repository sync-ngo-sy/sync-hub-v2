// PROTOTYPE for #369 — throwaway. Not chosen; kept as the record of what A was judged against.
//
// C — Ask at the upload, and remember. The question is put the moment the file is chosen, about a
// parse that has not happened yet, so the wait is never interrupted. The answer stands for every
// CV after it until it is changed. The save bar carries the whole story: what is being read, what
// it is going to do, and how to take it back.

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
import { LoaderCircle, Undo2 } from 'lucide-react';
import { isWaiting } from './update-stub';
import { SAVE_BAR, type VariantProps } from './variant';

export const NAME = 'Ask at the upload';

export function VariantC({
  update,
  cvs,
  card,
  fields,
  onSubmit,
  isDirty,
  isSubmitting,
}: VariantProps) {
  const { answer, asking, cvName, remembered, updatedBy } = update.state;
  const waiting = isWaiting(update.state);

  return (
    <>
      {cvs()}
      {card}

      <form onSubmit={onSubmit} noValidate className="space-y-6">
        {fields}

        <div className={`${SAVE_BAR} flex-col items-stretch sm:flex-row sm:items-center`}>
          <div className="min-w-0 space-y-0.5" aria-live="polite">
            {updatedBy ? (
              <>
                <p className="text-dense text-foreground">
                  The fields now say what <span className="font-medium">{updatedBy}</span> says.
                </p>
                <p className="text-meta text-muted-foreground">Nothing is saved yet.</p>
              </>
            ) : waiting ? (
              <>
                <p className="flex items-center gap-2 text-dense text-foreground">
                  <LoaderCircle aria-hidden="true" className="size-3.5 shrink-0 animate-spin" />
                  Reading <span className="min-w-0 font-medium">{cvName}</span>
                </p>
                <p className="text-meta text-muted-foreground">
                  {answer === 'update'
                    ? 'It updates the fields below when it has been read.'
                    : answer === 'keep'
                      ? 'What you typed stays as it is.'
                      : 'Waiting for your answer.'}
                </p>
              </>
            ) : (
              <>
                <p className="text-dense text-muted-foreground">
                  {isDirty ? 'Unsaved changes.' : 'Everything is saved.'}
                </p>
                {remembered ? (
                  <p className="text-meta text-muted-foreground">
                    {remembered === 'update'
                      ? 'A new CV updates these fields without asking.'
                      : 'A new CV leaves these fields alone.'}{' '}
                    <button
                      type="button"
                      onClick={update.forget}
                      className="underline underline-offset-4 hover:text-foreground"
                    >
                      Ask me next time
                    </button>
                  </p>
                ) : null}
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {waiting && answer ? (
              <Button type="button" variant="ghost" onClick={update.ask}>
                Change
              </Button>
            ) : null}
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
            <AlertDialogTitle>
              Update your profile from this CV when it has been read?
            </AlertDialogTitle>
            <AlertDialogDescription>
              <TruncatedText className="mb-1 font-medium text-foreground">
                {cvName ?? ''}
              </TruncatedText>
              Your Experience, Education, Languages, Projects and Links will say what it says, in
              place of what is there now. Skills you have listed keep their years. We remember this
              answer for the CVs you upload after it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => update.reply('keep')}>
              No, keep my answers
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => update.reply('update')}>
              Yes, update it
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
