import { Separator } from '@sync/ui/components/ui/separator';
import { type ReactNode, useId } from 'react';
import { absoluteDateTime } from '@/lib/dates';
import {
  experienceLabel,
  type Job,
  jobMeta,
  languageName,
  proficiencyLabel,
  questionShape,
  skillDemand,
  yearsAsked,
} from '../job';
import { ApplyCta } from './apply-cta';

interface JobDetailProps {
  job: Job;
  signedIn: boolean;
  /** Where sign-in should come back to — this Job's own address, whichever route reached it. */
  returnTo: string;
}

export function JobDetail({ job, signedIn, returnTo }: JobDetailProps) {
  const experience = yearsAsked(job.minimum_total_experience_years);
  const asksForSomething = experience !== null || job.skills.length > 0 || job.languages.length > 0;

  return (
    <article className="space-y-10">
      <header className="space-y-4">
        <div className="space-y-2">
          <h1 className="font-heading text-page-title text-foreground">{job.title}</h1>
          <p className="text-dense text-muted-foreground">{jobMeta(job)}</p>
        </div>
        <p className="text-meta text-muted-foreground">
          Posted <time dateTime={job.created_at}>{absoluteDateTime(job.created_at)}</time>
          {job.expires_at ? (
            <>
              {' · Closes '}
              <time dateTime={job.expires_at}>{absoluteDateTime(job.expires_at)}</time>
            </>
          ) : null}
        </p>
        <ApplyCta signedIn={signedIn} returnTo={returnTo} />
      </header>

      <Separator />

      <Section title="About this role">
        <p className="max-w-prose whitespace-pre-line text-reading text-foreground">
          {job.description}
        </p>
      </Section>

      {asksForSomething ? (
        <Section title="What this role asks for">
          {experience === null ? null : (
            <p className="text-dense text-foreground">{experienceLabel(experience)}</p>
          )}
          {job.skills.length > 0 ? (
            <Criteria label="Skills">
              {job.skills.map((skill) => (
                <CriteriaRow key={skill.name} term={skill.name} detail={skillDemand(skill)} />
              ))}
            </Criteria>
          ) : null}
          {job.languages.length > 0 ? (
            <Criteria label="Languages">
              {job.languages.map((language) => (
                <CriteriaRow
                  key={language.code}
                  term={languageName(language.code)}
                  detail={proficiencyLabel(language)}
                />
              ))}
            </Criteria>
          ) : null}
        </Section>
      ) : null}

      {job.questions.length > 0 ? (
        <Section title="What you'll be asked">
          <ol aria-label="Application questions" className="space-y-3">
            {job.questions.map((question) => (
              <li key={question.id} className="flex flex-col gap-1">
                <span className="text-dense text-foreground">{question.question_text}</span>
                <span className="text-meta text-muted-foreground">{questionShape(question)}</span>
              </li>
            ))}
          </ol>
        </Section>
      ) : null}
    </article>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const headingId = useId();

  return (
    <section aria-labelledby={headingId} className="space-y-4">
      <h2 id={headingId} className="font-heading text-h3 text-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Criteria({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="text-meta text-muted-foreground uppercase tracking-[0.08em]">{label}</h3>
      <ul aria-label={label} className="divide-y divide-border border-t border-border">
        {children}
      </ul>
    </div>
  );
}

function CriteriaRow({ term, detail }: { term: string; detail: string }) {
  return (
    <li className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-3">
      <span className="text-dense text-foreground">{term}</span>
      <span className="text-meta text-muted-foreground">{detail}</span>
    </li>
  );
}
