import { SkeletonText } from '@sync/ui/components/skeletons';
import { Alert, AlertDescription, AlertTitle } from '@sync/ui/components/ui/alert';
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
import { CircleAlert } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { RetryNotice } from '@/features/shell/components/retry-notice';
import { ReviewCard } from '@/features/shell/components/review-card';
import { problemMessage } from '@/lib/api-problem';
import { absoluteDateTime, relativeTime } from '@/lib/dates';
import { type Note, type NotesWidget, noteByline } from '../note';
import { NoteForm } from './note-form';

const HINT = 'Your team only — the candidate never sees these.';

export function NotesCard({ notes }: { notes: NotesWidget }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [erasing, setErasing] = useState<Note | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  async function erase(note: Note) {
    try {
      await notes.erase(note.id);
      setErasing(null);
      toast.success('Note deleted');
    } catch (error) {
      setFailure(problemMessage(error, "That note couldn't be deleted. It still reads as it did."));
      setErasing(null);
    }
  }

  return (
    <ReviewCard title="Notes" hint={HINT}>
      <div className="space-y-6">
        <NoteForm
          label="New note"
          placeholder="What should your team know about this Application?"
          submitLabel="Add note"
          pendingLabel="Adding note…"
          refusalTitle="Note not added"
          refusalFallback="That note couldn't be added."
          onSubmit={async (text) => {
            setFailure(null);
            await notes.write(text);
            toast.success('Note added');
          }}
        />

        {failure ? (
          <Alert>
            <CircleAlert aria-hidden="true" />
            <AlertTitle>Notes unchanged</AlertTitle>
            <AlertDescription>{failure}</AlertDescription>
          </Alert>
        ) : null}

        {notes.error ? (
          <RetryNotice
            message={problemMessage(notes.error, "Couldn't load the notes on this Application.")}
            onRetry={notes.refetch}
          />
        ) : null}

        {notes.isPending ? <SkeletonText lines={3} /> : null}

        {notes.notes.length > 0 ? (
          <ul aria-label="Notes" className="divide-y divide-border">
            {notes.notes.map((note) => (
              <li key={note.id} className="space-y-2 py-4 first:pt-0 last:pb-0">
                {editing === note.id ? (
                  <NoteForm
                    label="Note"
                    defaultText={note.text}
                    submitLabel="Save note"
                    pendingLabel="Saving note…"
                    refusalTitle="Note not saved"
                    refusalFallback="That note couldn't be saved. It still reads as it did."
                    autoFocus
                    onSubmit={async (text) => {
                      setFailure(null);
                      await notes.rewrite(note.id, text);
                      setEditing(null);
                      toast.success('Note saved');
                    }}
                    onCancel={() => setEditing(null)}
                  />
                ) : (
                  <NoteEntry
                    note={note}
                    onEdit={() => {
                      setFailure(null);
                      setEditing(note.id);
                    }}
                    onErase={() => {
                      setFailure(null);
                      setErasing(note);
                    }}
                  />
                )}
              </li>
            ))}
          </ul>
        ) : null}

        {!notes.isPending && !notes.error && notes.notes.length === 0 ? (
          <p className="text-dense text-muted-foreground">
            Nothing written down yet. The first note is the one your colleagues will read first.
          </p>
        ) : null}

        {notes.loadMore ? (
          <Button
            variant="outline"
            size="sm"
            disabled={notes.isLoadingMore}
            onClick={notes.loadMore}
          >
            {notes.isLoadingMore ? 'Loading…' : 'Show older notes'}
          </Button>
        ) : null}
      </div>

      <EraseNoteDialog
        note={erasing}
        onConfirm={(note) => void erase(note)}
        onClose={() => setErasing(null)}
      />
    </ReviewCard>
  );
}

interface NoteEntryProps {
  note: Note;
  onEdit: () => void;
  onErase: () => void;
}

function NoteEntry({ note, onEdit, onErase }: NoteEntryProps) {
  const byline = noteByline(note);
  const stamp = absoluteDateTime(byline.at);
  const whose = `${byline.author}'s note from ${stamp}`;

  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-meta text-muted-foreground">
          {byline.author} ·{' '}
          <time dateTime={byline.at} title={stamp}>
            {relativeTime(byline.at)}
          </time>
          {byline.edited ? ' · edited' : null}
        </p>
        <span className="flex gap-1">
          <Button variant="ghost" size="sm" aria-label={`Edit ${whose}`} onClick={onEdit}>
            Edit
          </Button>
          <Button variant="ghost" size="sm" aria-label={`Delete ${whose}`} onClick={onErase}>
            Delete
          </Button>
        </span>
      </div>
      <p className="whitespace-pre-wrap text-dense text-foreground">{note.text}</p>
    </>
  );
}

interface EraseNoteDialogProps {
  note: Note | null;
  onConfirm: (note: Note) => void;
  onClose: () => void;
}

function EraseNoteDialog({ note, onConfirm, onClose }: EraseNoteDialogProps) {
  if (!note) return null;

  return (
    <AlertDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this note?</AlertDialogTitle>
          <AlertDialogDescription>
            Your team loses these words, and nothing else about the Application changes.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={() => onConfirm(note)}>
            Delete note
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
