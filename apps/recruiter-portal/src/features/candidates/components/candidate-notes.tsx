import { NotesCard } from '@/features/crm/components/notes-card';
import { CANDIDATE } from '@/features/crm/subject';
import { useCandidateNotes } from '../hooks/use-candidate-notes';

export function CandidateNotes({ candidateId }: { candidateId: string }) {
  const notes = useCandidateNotes(candidateId);

  return <NotesCard notes={notes} subject={CANDIDATE} />;
}
