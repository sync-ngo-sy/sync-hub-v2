import { SkeletonText } from '@sync/ui/components/skeletons';
import { Alert, AlertDescription, AlertTitle } from '@sync/ui/components/ui/alert';
import { Button } from '@sync/ui/components/ui/button';
import { cn } from '@sync/ui/lib/utils';
import { CircleAlert, Sparkles, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { ReviewCard } from '@/features/shell/components/review-card';
import { problemDetail } from '@/lib/api-problem';
import { absoluteDateTime } from '@/lib/dates';
import { assessmentProvenance, type MatchAssessment, matchLabel } from '../assessment';
import { useAssessMatch, useForgetAssessment } from '../hooks/use-application-actions';
import { useMatchAssessments } from '../hooks/use-match-assessments';

const ADVICE =
  'Advice drawn from the Snapshot and the Job — it does not change the Screening verdict.';

const LEAVING =
  'motion-safe:animate-out motion-safe:fade-out-0 motion-safe:slide-out-to-right-8 motion-safe:duration-300 motion-safe:fill-mode-forwards';

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

interface AssessmentProps {
  assessment: MatchAssessment;
  isLeaving: boolean;
  refusal: string | null;
  onForget: () => void;
}

function Assessment({ assessment, isLeaving, refusal, onForget }: AssessmentProps) {
  const label = matchLabel(assessment.match_percentage);
  const stamp = absoluteDateTime(assessment.assessed_at);
  const strengths = assessment.strengths ?? [];
  const gaps = assessment.gaps ?? [];
  const wordless = !assessment.explanation && strengths.length === 0 && gaps.length === 0;

  return (
    <li
      aria-label={label}
      className={cn(
        'space-y-2 border-border border-t pt-4 first:border-t-0 first:pt-0',
        isLeaving && LEAVING,
      )}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4">
        <h3 className="font-medium text-dense text-foreground">{label}</h3>
        <span className="flex items-baseline gap-2">
          <time dateTime={assessment.assessed_at} className="text-meta text-muted-foreground">
            {stamp}
          </time>
          <Button
            variant="ghost"
            size="sm"
            aria-label={`Delete the reading from ${stamp}`}
            disabled={isLeaving}
            onClick={onForget}
          >
            <Trash2 aria-hidden="true" />
          </Button>
        </span>
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

      {refusal ? (
        <Alert>
          <CircleAlert aria-hidden="true" />
          <AlertTitle>This reading is still here</AlertTitle>
          <AlertDescription>{refusal}</AlertDescription>
        </Alert>
      ) : null}
    </li>
  );
}

export function MatchAssessments({ applicationId }: { applicationId: string }) {
  const assessments = useMatchAssessments(applicationId);
  const asking = useAssessMatch(applicationId);
  const forgetting = useForgetAssessment(applicationId);
  const [refused, setRefused] = useState<string | null>(null);
  const [leaving, setLeaving] = useState<string | null>(null);
  const [unforgotten, setUnforgotten] = useState<{ id: string; detail: string } | null>(null);

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

  async function forget(assessmentId: string) {
    if (leaving) return;
    setLeaving(assessmentId);
    setUnforgotten(null);
    try {
      await forgetting.mutateAsync({
        params: { path: { application_id: applicationId, assessment_id: assessmentId } },
      });
    } catch (error) {
      setUnforgotten({
        id: assessmentId,
        detail: problemDetail(error, "That reading couldn't be deleted. It is still on record."),
      });
    } finally {
      setLeaving(null);
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
              <Assessment
                key={assessment.id}
                assessment={assessment}
                isLeaving={leaving === assessment.id}
                refusal={unforgotten?.id === assessment.id ? unforgotten.detail : null}
                onForget={() => void forget(assessment.id)}
              />
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
