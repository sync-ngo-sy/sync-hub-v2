import { TagsCard } from '@/features/crm/components/tags-card';
import { useApplicationTags } from '../hooks/use-application-tags';

export function ApplicationTags({ applicationId }: { applicationId: string }) {
  const tags = useApplicationTags(applicationId);

  return <TagsCard tags={tags} />;
}
