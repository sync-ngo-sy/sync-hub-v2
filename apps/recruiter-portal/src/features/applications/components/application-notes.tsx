import { NotesCard } from '@/features/crm/components/notes-card';
import { useApplicationNotes } from '../hooks/use-application-notes';

export function ApplicationNotes({ applicationId }: { applicationId: string }) {
  const notes = useApplicationNotes(applicationId);

  return <NotesCard notes={notes} />;
}
