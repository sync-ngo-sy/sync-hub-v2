import { Card, CardContent, CardDescription, CardHeader } from '@sync/ui/components/ui/card';
import type { ReactNode } from 'react';
import { useLanguageName } from '@/features/reference/hooks/use-languages';
import { useLocations } from '@/features/reference/hooks/use-locations';
import { absoluteDateTime } from '@/lib/dates';
import { employmentTypeLabel, workModeLabel } from '../job';
import {
  type CriteriaFormValues,
  IMPORTANCE_LABELS,
  PROFICIENCY_LABELS,
  QUESTION_TYPE_LABELS,
} from '../schemas/criteria';
import type { JobFormValues } from '../schemas/job';

interface JobWizardReviewProps {
  details: JobFormValues;
  screening: CriteriaFormValues;
}

export function JobWizardReview({ details, screening }: JobWizardReviewProps) {
  const places = useLocations();
  const languageName = useLanguageName();
  const locationName =
    places.data?.find((place) => place.key === details.locationKey)?.name ?? details.locationKey;

  return (
    <div className="space-y-5">
      <ReviewSection title="Details" description="How the role reads to a Candidate.">
        <ReviewRow label="Title">{details.title}</ReviewRow>
        <ReviewRow label="Description">
          <span className="whitespace-pre-wrap">{details.description}</span>
        </ReviewRow>
        <ReviewRow label="Location">{locationName || 'Not set'}</ReviewRow>
        <ReviewRow label="Work mode">
          {workModeLabel(details.workMode || null) ?? 'Not set'}
        </ReviewRow>
        <ReviewRow label="Employment type">
          {employmentTypeLabel(details.employmentType || null) ?? 'Not set'}
        </ReviewRow>
        <ReviewRow label="Closing date">
          {details.expiresAt ? absoluteDateTime(new Date(details.expiresAt).toISOString()) : 'None'}
        </ReviewRow>
      </ReviewSection>

      <ReviewSection title="Screening" description="The bar every applicant is measured against.">
        <ReviewRow label="Minimum total experience">
          {screening.minimumTotalExperienceYears
            ? `${screening.minimumTotalExperienceYears} years`
            : 'No minimum'}
        </ReviewRow>
        <ReviewRow label="Skills">
          <ReviewList
            empty="No skills screen applicants for this Job."
            items={screening.skills.map((skill) =>
              [
                skill.name,
                IMPORTANCE_LABELS[skill.importance],
                skill.minimumYears ? `${skill.minimumYears} years` : null,
              ]
                .filter(Boolean)
                .join(' · '),
            )}
          />
        </ReviewRow>
        <ReviewRow label="Languages">
          <ReviewList
            empty="No languages screen applicants for this Job."
            items={screening.languages.map(
              (language) =>
                `${languageName(language.code)} · ${PROFICIENCY_LABELS[language.minimumProficiency]}`,
            )}
          />
        </ReviewRow>
        <ReviewRow label="Questions">
          <ReviewList
            empty="This Job asks no application questions."
            items={screening.questions.map((question) =>
              [
                question.questionText,
                QUESTION_TYPE_LABELS[question.questionType],
                question.isRequired ? 'Required' : 'Optional',
                question.questionType === 'yes_no' && question.acceptedAnswer !== 'none'
                  ? `Passes on ${question.acceptedAnswer}`
                  : null,
              ]
                .filter(Boolean)
                .join(' · '),
            )}
          />
        </ReviewRow>
      </ReviewSection>
    </div>
  );
}

function ReviewSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <h2 className="font-heading text-h3 text-card-foreground">{title}</h2>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-4 sm:grid-cols-[12rem_minmax(0,1fr)]">{children}</dl>
      </CardContent>
    </Card>
  );
}

function ReviewRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="contents">
      <dt className="text-dense font-medium text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-dense text-foreground">{children}</dd>
    </div>
  );
}

function ReviewList({ items, empty }: { items: string[]; empty: string }) {
  if (items.length === 0) return <span className="text-muted-foreground">{empty}</span>;

  return (
    <ul className="space-y-1">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}
