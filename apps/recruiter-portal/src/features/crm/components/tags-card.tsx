import { Alert, AlertDescription, AlertTitle } from '@sync/ui/components/ui/alert';
import { Badge } from '@sync/ui/components/ui/badge';
import { Skeleton } from '@sync/ui/components/ui/skeleton';
import { CircleAlert, X } from 'lucide-react';
import { useState } from 'react';
import { RetryNotice } from '@/features/shell/components/retry-notice';
import { ReviewCard } from '@/features/shell/components/review-card';
import { problemDetail, problemMessage } from '@/lib/api-problem';
import type { CrmSubject } from '../subject';
import type { Tag, TagsWidget } from '../tag';
import { TagPicker } from './tag-picker';

export function TagsCard({ tags, subject }: { tags: TagsWidget; subject: CrmSubject }) {
  const [failure, setFailure] = useState<string | null>(null);

  async function attempt(change: () => Promise<unknown>, fallback: string) {
    if (tags.isChanging) return;
    setFailure(null);
    try {
      await change();
    } catch (error) {
      setFailure(problemDetail(error, fallback));
    }
  }

  const isOn = (tagId: string) => tags.on.some((tag) => tag.id === tagId);

  function toggle(tagId: string) {
    void attempt(
      () => (isOn(tagId) ? tags.take(tagId) : tags.put(tagId)),
      `That Tag couldn't be changed. The ${subject.one} is filed as it was.`,
    );
  }

  return (
    <ReviewCard
      title="Tags"
      hint={`How your team files this ${subject.one}. Your Tags, and yours alone.`}
    >
      <div className="space-y-4">
        {tags.error ? (
          <RetryNotice
            message={problemMessage(tags.error, `Couldn't load the Tags on this ${subject.one}.`)}
            onRetry={tags.refetch}
          />
        ) : null}

        {tags.isPending ? (
          <div aria-hidden="true" className="flex gap-2">
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-5 w-24" />
          </div>
        ) : null}

        {failure ? (
          <Alert>
            <CircleAlert aria-hidden="true" />
            <AlertTitle>Tags unchanged</AlertTitle>
            <AlertDescription>{failure}</AlertDescription>
          </Alert>
        ) : null}

        {tags.on.length > 0 ? (
          <ul aria-label={`Tags on this ${subject.one}`} className="flex flex-wrap gap-2">
            {tags.on.map((tag) => (
              <li key={tag.id}>
                <OnTag tag={tag} onTakeOff={() => toggle(tag.id)} />
              </li>
            ))}
          </ul>
        ) : null}

        {tags.error ? null : (
          <TagPicker
            subject={subject}
            vocabulary={tags.vocabulary}
            on={tags.on}
            isChanging={tags.isChanging}
            onToggle={toggle}
            onCreate={(name) =>
              void attempt(
                () => tags.create(name),
                `“${name}” couldn't be put on this ${subject.one}.`,
              )
            }
          />
        )}
      </div>
    </ReviewCard>
  );
}

function OnTag({ tag, onTakeOff }: { tag: Tag; onTakeOff: () => void }) {
  return (
    <Badge variant="tag" className="gap-1 pr-1">
      {tag.name}
      <button
        type="button"
        aria-label={`Take off ${tag.name}`}
        onClick={onTakeOff}
        className="rounded-sm p-0.5 outline-none hover:bg-tag-foreground/15 focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <X aria-hidden="true" className="size-3" />
      </button>
    </Badge>
  );
}
