import { TagsCard } from '@/features/crm/components/tags-card';
import { CANDIDATE } from '@/features/crm/subject';
import { useCandidateTags } from '../hooks/use-candidate-tags';

export function CandidateTags({ candidateId }: { candidateId: string }) {
  const tags = useCandidateTags(candidateId);

  return <TagsCard tags={tags} subject={CANDIDATE} />;
}
