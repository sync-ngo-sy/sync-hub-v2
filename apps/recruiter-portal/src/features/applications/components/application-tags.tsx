import { TagsCard } from '@/features/crm/components/tags-card';
import { APPLICATION } from '@/features/crm/subject';
import { useApplicationTags } from '../hooks/use-application-tags';

export function ApplicationTags({ applicationId }: { applicationId: string }) {
  const tags = useApplicationTags(applicationId);

  return <TagsCard tags={tags} subject={APPLICATION} />;
}
