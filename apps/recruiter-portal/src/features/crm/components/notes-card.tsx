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
import { problemDetail, problemMessage } from '@/lib/api-problem';
import { absoluteDateTime, relativeTime } from '@/lib/dates';
import { type Note, type NotesWidget, noteByline } from '../note';
import type { CrmSubject } from '../subject';
import { NoteForm } from './note-form';

const HINT = 'Your team only — the candidate never sees these.';

export function NotesCard({ notes, subject }: { notes: NotesWidget; subject: CrmSubject }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Note | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  async function remove(note: Note) {
    if (isDeleting) return;
    setIsDeleting(true);
    try {
      await notes.remove(note.id);
      toast.success('Note deleted');
    } catch (error) {
      setFailure(problemDetail(error, "That note couldn't be deleted. It still reads as it did."));
    } finally {
      setIsDeleting(false);
      setDeleting(null);
    }
  }

  return (
    <ReviewCard title="Notes" hint={HINT}>
      <div className="space-y-6">
        <NoteForm
          label="New note"
          placeholder={`What should your team know about this ${subject.one}?`}
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
            message={problemMessage(notes.error, `Couldn't load the notes on this ${subject.one}.`)}
            onRetry={notes.refetch}
          />
        ) : null}

        {notes.isPending ? <SkeletonText lines={3} /> : null}

        {notes.items.length > 0 ? (
          <ul aria-label="Notes" className="divide-y divide-border">
            {notes.items.map((note) => (
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
                    onDelete={() => {
                      setFailure(null);
                      setDeleting(note);
                    }}
                  />
                )}
              </li>
            ))}
          </ul>
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

      <DeleteNoteDialog
        note={deleting}
        subject={subject}
        isDeleting={isDeleting}
        onConfirm={(note) => void remove(note)}
        onClose={() => setDeleting(null)}
      />
    </ReviewCard>
  );
}

interface NoteEntryProps {
  note: Note;
  onEdit: () => void;
  onDelete: () => void;
}

function NoteEntry({ note, onEdit, onDelete }: NoteEntryProps) {
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
          <Button
            variant="destructive-outline"
            size="sm"
            aria-label={`Delete ${whose}`}
            onClick={onDelete}
          >
            Delete
          </Button>
        </span>
      </div>
      <p className="whitespace-pre-wrap text-dense text-foreground">{note.text}</p>
    </>
  );
}

interface DeleteNoteDialogProps {
  note: Note | null;
  subject: CrmSubject;
  isDeleting: boolean;
  onConfirm: (note: Note) => void;
  onClose: () => void;
}

function DeleteNoteDialog({
  note,
  subject,
  isDeleting,
  onConfirm,
  onClose,
}: DeleteNoteDialogProps) {
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
            {`Your team loses these words, and nothing else about the ${subject.one} changes.`}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={isDeleting}
            onClick={() => onConfirm(note)}
          >
            {isDeleting ? 'Deleting note…' : 'Delete note'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
