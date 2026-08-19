// PROTOTYPE for #369 — throwaway. Not chosen; kept as the record of what A was judged against.
//
// B — Ask in place, never block. Nothing moves and nothing covers the page: the question sits in
// the CV's own row and waits. Leaving is the same as saying no. Nothing is remembered, because the
// offer costs nothing to leave standing. The save bar stays the size it is and carries Undo on one
// line.

import { Button } from '@sync/ui/components/ui/button';
import { Undo2, Wand2 } from 'lucide-react';
import { UPDATE_FROM_CV } from './stub-cvs';
import { SAVE_BAR, type VariantProps } from './variant';

export const NAME = 'Ask in the CV row';

export function VariantB({
  update,
  cvs,
  card,
  fields,
  onSubmit,
  isDirty,
  isSubmitting,
}: VariantProps) {
  const { asking, answer, updatedBy, phase } = update.state;

  const offer = asking ? (
    <div className="space-y-3 rounded-lg border border-border bg-muted/40 p-3">
      <div>
        <p className="text-dense font-medium text-foreground">Update your profile from this CV?</p>
        <p className="text-meta text-muted-foreground">
          Your Experience, Education, Languages, Projects and Links would say what it says, in place
          of what is there now. Skills keep the years you typed.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={() => update.reply('update')}>
          <Wand2 aria-hidden="true" />
          Update from this CV
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => update.reply('keep')}>
          No, keep what I typed
        </Button>
      </div>
    </div>
  ) : phase === 'read' && answer === 'keep' ? (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <p className="text-meta text-muted-foreground">Your typed answers were kept.</p>
      <Button type="button" variant="outline" size="sm" onClick={() => update.reply('update')}>
        <Wand2 aria-hidden="true" />
        {UPDATE_FROM_CV}
      </Button>
    </div>
  ) : undefined;

  return (
    <>
      {cvs(offer)}
      {card}

      <form onSubmit={onSubmit} noValidate className="space-y-6">
        {fields}

        <div className={SAVE_BAR}>
          <p className="min-w-0 text-dense text-muted-foreground" aria-live="polite">
            {isDirty ? 'Unsaved changes.' : 'Everything is saved.'}
            {updatedBy ? (
              <>
                {' '}
                From <span className="font-medium text-foreground">{updatedBy}</span>.{' '}
                <button
                  type="button"
                  onClick={update.undo}
                  className="inline-flex items-center gap-1 underline underline-offset-4 hover:text-foreground"
                >
                  <Undo2 aria-hidden="true" className="size-3.5" />
                  Undo the update
                </button>
              </>
            ) : null}
          </p>

          {isDirty || isSubmitting ? (
            <Button type="submit" size="lg" disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : 'Save profile'}
            </Button>
          ) : null}
        </div>
      </form>
    </>
  );
}
