import type { components } from '@sync/api-client/schema';
import { Button } from '@sync/ui/components/ui/button';
import { Link } from '@tanstack/react-router';
import { Briefcase, MapPin } from 'lucide-react';
import { formatAbsoluteDate, humanizeEmploymentType } from '../lib/format';

type PublicJob = components['schemas']['PublicJob'];
type LanguageProficiency = components['schemas']['LanguageProficiency'];

const PROFICIENCY_LABEL: Record<LanguageProficiency, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
  fluent: 'Fluent',
  native: 'Native',
};

function skillDetail(skill: PublicJob['skills'][number]): string | null {
  const parts: string[] = [];
  if (skill.minimum_years) parts.push(`${skill.minimum_years}+ yrs`);
  if (skill.importance === 'required') parts.push('required');
  return parts.length ? parts.join(' · ') : null;
}

function Pill({ label, detail }: { label: string; detail?: string | null }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs">
      <span className="font-medium text-foreground">{label}</span>
      {detail ? <span className="text-muted-foreground">{detail}</span> : null}
    </span>
  );
}

// The Apply call-to-action only carries a signed-out visitor into auth here; submitting an
// Application ships in its own ticket (#55).
export function JobDetail({ job, returnTo }: { job: PublicJob; returnTo: string }) {
  const hasRequirements =
    job.minimum_total_experience_years != null || job.skills.length > 0 || job.languages.length > 0;

  return (
    <article className="space-y-8">
      <header className="space-y-4">
        <div className="space-y-1">
          <h1 className="text-h1 font-heading text-foreground">{job.title}</h1>
          <p className="text-muted-foreground">{job.tenant.name}</p>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          {job.location ? (
            <span className="inline-flex items-center gap-1">
              <MapPin aria-hidden className="size-4" />
              {job.location}
            </span>
          ) : null}
          {job.employment_type ? (
            <span className="inline-flex items-center gap-1">
              <Briefcase aria-hidden className="size-4" />
              {humanizeEmploymentType(job.employment_type)}
            </span>
          ) : null}
          <span>Posted {formatAbsoluteDate(job.created_at)}</span>
          {job.expires_at ? <span>Closes {formatAbsoluteDate(job.expires_at)}</span> : null}
        </div>
        <Button
          size="lg"
          render={
            <Link to="/login" search={{ returnTo }}>
              Apply now
            </Link>
          }
        />
      </header>

      <section className="space-y-3">
        <h2 className="text-h3 font-heading text-foreground">About this role</h2>
        <div className="leading-relaxed whitespace-pre-line text-foreground/90">
          {job.description}
        </div>
      </section>

      {hasRequirements ? (
        <section className="space-y-4">
          <h2 className="text-h3 font-heading text-foreground">Requirements</h2>
          {job.minimum_total_experience_years != null ? (
            <p className="text-sm text-muted-foreground">
              {job.minimum_total_experience_years}+ years of total experience
            </p>
          ) : null}
          {job.skills.length > 0 ? (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-foreground">Skills</h3>
              <div className="flex flex-wrap gap-2">
                {job.skills.map((skill) => (
                  <Pill key={skill.name} label={skill.name} detail={skillDetail(skill)} />
                ))}
              </div>
            </div>
          ) : null}
          {job.languages.length > 0 ? (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-foreground">Languages</h3>
              <div className="flex flex-wrap gap-2">
                {job.languages.map((language) => (
                  <Pill
                    key={language.code}
                    label={language.code.toUpperCase()}
                    detail={PROFICIENCY_LABEL[language.minimum_proficiency]}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {job.questions.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-h3 font-heading text-foreground">Application questions</h2>
          <ul className="space-y-2 text-sm text-foreground/90">
            {job.questions.map((question) => (
              <li key={question.id} className="flex gap-2">
                <span aria-hidden className="text-muted-foreground">
                  •
                </span>
                <span>
                  {question.question_text}
                  {question.is_required ? null : (
                    <span className="text-muted-foreground"> (optional)</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </article>
  );
}
