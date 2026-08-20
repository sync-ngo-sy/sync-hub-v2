import { SkeletonText } from '@sync/ui/components/skeletons';
import { Alert, AlertDescription, AlertTitle } from '@sync/ui/components/ui/alert';
import { Button } from '@sync/ui/components/ui/button';
import { CircleAlert, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { ReviewCard } from '@/features/shell/components/review-card';
import { problemDetail } from '@/lib/api-problem';
import { absoluteDateTime } from '@/lib/dates';
import { assessmentProvenance, type MatchAssessment, matchLabel, NO_REASONS } from '../assessment';
import { useAssessMatch } from '../hooks/use-application-actions';
import { useMatchAssessment } from '../hooks/use-match-assessment';

const NOT_READ_YET =
  'No AI has read this Application against the Job yet. One is usually read within a minute of it arriving.';

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

function Reading({ assessment }: { assessment: MatchAssessment }) {
  const label = matchLabel(assessment.match_percentage);
  const strengths = assessment.strengths ?? [];
  const gaps = assessment.gaps ?? [];
  const wordless = !assessment.explanation && strengths.length === 0 && gaps.length === 0;
  const reread = assessment.assessed_at !== assessment.first_assessed_at;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4">
        <h3 className="font-medium text-dense text-foreground">{label}</h3>
        <time dateTime={assessment.assessed_at} className="text-meta text-muted-foreground">
          {reread ? 'Read again ' : ''}
          {absoluteDateTime(assessment.assessed_at)}
        </time>
      </div>

      {assessment.explanation ? (
        <p className="text-dense text-muted-foreground">{assessment.explanation}</p>
      ) : null}
      {wordless ? <p className="text-dense text-muted-foreground">{NO_REASONS}</p> : null}

      {strengths.length > 0 ? <Reasons title="Strengths" phrases={strengths} /> : null}
      {gaps.length > 0 ? <Reasons title="Gaps" phrases={gaps} /> : null}

      <p className="text-meta text-muted-foreground">{assessmentProvenance(assessment)}</p>
    </div>
  );
}

export function MatchAssessmentCard({ applicationId }: { applicationId: string }) {
  const assessment = useMatchAssessment(applicationId);
  const asking = useAssessMatch(applicationId);
  const [refused, setRefused] = useState<string | null>(null);

  const reading = assessment.data ?? null;
  const failure = assessment.isError
    ? problemDetail(assessment.error, "The reading couldn't be read.")
    : refused;

  async function ask() {
    setRefused(null);
    try {
      await asking.mutateAsync({ params: { path: { application_id: applicationId } } });
    } catch (error) {
      setRefused(
        problemDetail(error, "This Application couldn't be read again. Nothing was changed."),
      );
    }
  }

  return (
    <ReviewCard title="Match assessment">
      <div className="space-y-4">
        <Button
          variant="outline"
          className="w-full"
          disabled={asking.isPending}
          onClick={() => void ask()}
        >
          <Sparkles aria-hidden="true" />
          {asking.isPending
            ? 'Reading the Application…'
            : reading
              ? 'Ask for a new reading'
              : 'Ask for a reading'}
        </Button>

        {asking.isPending ? (
          <p role="status" className="text-meta text-muted-foreground">
            The model is reading the Snapshot against the Job. This takes a moment, and replaces the
            reading below when it lands.
          </p>
        ) : null}

        {failure ? (
          <Alert>
            <CircleAlert aria-hidden="true" />
            <AlertTitle>
              {assessment.isError ? 'Not everything loaded' : 'The reading is unchanged'}
            </AlertTitle>
            <AlertDescription>{failure}</AlertDescription>
          </Alert>
        ) : null}

        {assessment.isPending ? <SkeletonText lines={3} /> : null}

        {assessment.isSuccess && !reading && !asking.isPending ? (
          <p className="text-dense text-muted-foreground">{NOT_READ_YET}</p>
        ) : null}

        {reading ? <Reading assessment={reading} /> : null}
      </div>
    </ReviewCard>
  );
}
