import { SkeletonText } from '@sync/ui/components/skeletons';
import { Alert, AlertDescription, AlertTitle } from '@sync/ui/components/ui/alert';
import { Button } from '@sync/ui/components/ui/button';
import { CircleAlert, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { ReviewCard } from '@/features/shell/components/review-card';
import { problemDetail } from '@/lib/api-problem';
import { absoluteDateTime } from '@/lib/dates';
import { assessmentProvenance, type MatchAssessment, matchLabel } from '../assessment';
import { useAssessMatch } from '../hooks/use-application-actions';
import { useMatchAssessments } from '../hooks/use-match-assessments';

const ADVICE =
  'Advice drawn from the Snapshot and the Job — it does not change the Screening verdict.';

function Reasons({ title, phrases }: { title: string; phrases: string[] }) {
  return (
    <div className="space-y-1">
      <p className="text-meta text-muted-foreground">{title}</p>
      <ul className="list-disc space-y-0.5 pl-4 text-dense">
        {[...new Set(phrases)].map((phrase) => (
          <li key={phrase}>{phrase}</li>
        ))}
      </ul>
    </div>
  );
}

function Assessment({ assessment }: { assessment: MatchAssessment }) {
  const label = matchLabel(assessment.match_percentage);
  const strengths = assessment.strengths ?? [];
  const gaps = assessment.gaps ?? [];
  const wordless = !assessment.explanation && strengths.length === 0 && gaps.length === 0;

  return (
    <li
      aria-label={label}
      className="space-y-2 border-border border-t pt-4 first:border-t-0 first:pt-0"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4">
        <h3 className="font-medium text-dense text-foreground">{label}</h3>
        <time dateTime={assessment.assessed_at} className="text-meta text-muted-foreground">
          {absoluteDateTime(assessment.assessed_at)}
        </time>
      </div>

      {assessment.explanation ? (
        <p className="text-dense text-muted-foreground">{assessment.explanation}</p>
      ) : null}
      {wordless ? (
        <p className="text-dense text-muted-foreground">
          The model gave no reasons for this reading.
        </p>
      ) : null}

      {strengths.length > 0 ? <Reasons title="Strengths" phrases={strengths} /> : null}
      {gaps.length > 0 ? <Reasons title="Gaps" phrases={gaps} /> : null}

      <p className="text-meta text-muted-foreground">{assessmentProvenance(assessment)}</p>
    </li>
  );
}

export function MatchAssessments({ applicationId }: { applicationId: string }) {
  const assessments = useMatchAssessments(applicationId);
  const asking = useAssessMatch(applicationId);
  const [refused, setRefused] = useState<string | null>(null);

  const items = assessments.data ?? [];
  const failure = assessments.isError
    ? problemDetail(assessments.error, "The older assessments couldn't be read.")
    : refused;

  async function ask() {
    setRefused(null);
    try {
      await asking.mutateAsync({ params: { path: { application_id: applicationId } } });
    } catch (error) {
      setRefused(
        problemDetail(error, "This Application couldn't be assessed. Nothing was recorded."),
      );
    }
  }

  return (
    <ReviewCard title="Match assessment" hint={ADVICE}>
      <div className="space-y-4">
        <Button
          variant="outline"
          className="w-full"
          disabled={asking.isPending}
          onClick={() => void ask()}
        >
          <Sparkles aria-hidden="true" />
          {asking.isPending ? 'Reading the Application…' : 'Ask for an assessment'}
        </Button>

        {asking.isPending ? (
          <p role="status" className="text-meta text-muted-foreground">
            The model is reading the Snapshot against the Job. This takes a moment.
          </p>
        ) : null}

        {failure ? (
          <Alert>
            <CircleAlert aria-hidden="true" />
            <AlertTitle>
              {assessments.isError ? 'Not everything loaded' : 'No assessment was made'}
            </AlertTitle>
            <AlertDescription>{failure}</AlertDescription>
          </Alert>
        ) : null}

        {assessments.isPending ? <SkeletonText lines={3} /> : null}

        {assessments.isSuccess && items.length === 0 && !asking.isPending ? (
          <p className="text-dense text-muted-foreground">
            No AI has read this Application against the Job yet.
          </p>
        ) : null}

        {items.length > 0 ? (
          <ol aria-label="Match assessments" className="space-y-4">
            {items.map((assessment) => (
              <Assessment key={assessment.id} assessment={assessment} />
            ))}
          </ol>
        ) : null}

        {assessments.hasNextPage ? (
          <Button
            variant="link"
            size="sm"
            disabled={assessments.isFetchingNextPage}
            onClick={() => void assessments.fetchNextPage()}
          >
            Show older assessments
          </Button>
        ) : null}
      </div>
    </ReviewCard>
  );
}
