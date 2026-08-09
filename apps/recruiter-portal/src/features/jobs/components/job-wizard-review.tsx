import type { ReactNode } from 'react';
import { useLanguageName } from '@/features/reference/hooks/use-languages';
import { useLocations } from '@/features/reference/hooks/use-locations';
import { absoluteDateTime } from '@/lib/dates';
import { employmentTypeLabel, workModeLabel } from '../job';
import {
  type CriteriaFormValues,
  IMPORTANCE_LABELS,
  NO_LANGUAGES,
  NO_QUESTIONS,
  NO_SKILLS,
  PROFICIENCY_LABELS,
  QUESTION_TYPE_LABELS,
} from '../schemas/criteria';
import type { JobFormValues } from '../schemas/job';
import { SectionCard } from './section-card';

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
      <SectionCard title="Details" description="How the role reads to a Candidate.">
        <ReviewRows>
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
            {details.expiresAt
              ? absoluteDateTime(new Date(details.expiresAt).toISOString())
              : 'None'}
          </ReviewRow>
        </ReviewRows>
      </SectionCard>

      <SectionCard title="Screening" description="The bar every applicant is measured against.">
        <ReviewRows>
          <ReviewRow label="Minimum total experience">
            {screening.minimumTotalExperienceYears
              ? `${screening.minimumTotalExperienceYears} years`
              : 'No minimum'}
          </ReviewRow>
          <ReviewRow label="Skills">
            <ReviewList
              empty={NO_SKILLS}
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
              empty={NO_LANGUAGES}
              items={screening.languages.map(
                (language) =>
                  `${languageName(language.code)} · ${PROFICIENCY_LABELS[language.minimumProficiency]}`,
              )}
            />
          </ReviewRow>
          <ReviewRow label="Questions">
            <ReviewList
              empty={NO_QUESTIONS}
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
        </ReviewRows>
      </SectionCard>
    </div>
  );
}

function ReviewRows({ children }: { children: ReactNode }) {
  return <dl className="grid gap-4 sm:grid-cols-[12rem_minmax(0,1fr)]">{children}</dl>;
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
