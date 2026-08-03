import type { ReactNode } from 'react';
import { useLanguages } from '@/features/reference/hooks/use-languages';
import { ReviewCard } from '@/features/shell/components/review-card';
import {
  LANGUAGE_PROFICIENCY_LABELS,
  linkLabel,
  period,
  type Snapshot,
  yearsOfExperience,
} from '../review';

const HINT =
  'What the candidate reviewed when they applied — not their profile as it stands today.';

export function ApplicationSnapshot({ snapshot }: { snapshot: Snapshot }) {
  const { data: languages } = useLanguages();
  const languageName = (code: string) =>
    languages?.find((language) => language.code === code)?.name ?? code.toUpperCase();

  const contact = [snapshot.location, snapshot.phone].filter(Boolean);
  const experiences = snapshot.experiences ?? [];
  const educations = snapshot.educations ?? [];
  const skills = snapshot.skills ?? [];
  const spokenLanguages = snapshot.languages ?? [];
  const projects = snapshot.projects ?? [];
  const unmapped = snapshot.unmapped_skills ?? [];

  const bare =
    !snapshot.summary &&
    contact.length === 0 &&
    experiences.length === 0 &&
    educations.length === 0 &&
    skills.length === 0 &&
    spokenLanguages.length === 0 &&
    projects.length === 0 &&
    unmapped.length === 0;

  return (
    <ReviewCard title="Snapshot" hint={HINT}>
      {bare ? (
        <p className="text-dense text-muted-foreground">
          Nothing else was on the profile when this Application was sent.
        </p>
      ) : (
        <div className="space-y-8">
          {contact.length > 0 || snapshot.summary ? (
            <div className="space-y-2">
              {contact.length > 0 ? (
                <ul className="flex flex-wrap gap-x-6 gap-y-1 text-dense text-muted-foreground">
                  {contact.map((detail) => (
                    <li key={detail}>{detail}</li>
                  ))}
                </ul>
              ) : null}
              {snapshot.summary ? (
                <p className="max-w-prose text-dense whitespace-pre-line">{snapshot.summary}</p>
              ) : null}
            </div>
          ) : null}

          {experiences.length > 0 ? (
            <Group title="Experience">
              {experiences.map((experience) => (
                <Entry
                  key={`${experience.job_title}-${experience.company_name}-${experience.start_year}-${experience.start_month}`}
                  title={experience.job_title}
                  subtitle={experience.company_name}
                  when={period(experience)}
                  description={experience.description}
                />
              ))}
            </Group>
          ) : null}

          {educations.length > 0 ? (
            <Group title="Education">
              {educations.map((education) => (
                <Entry
                  key={`${education.institution}-${education.degree}-${education.field_of_study}-${education.graduation_year}`}
                  title={education.institution}
                  subtitle={[education.degree, education.field_of_study].filter(Boolean).join(', ')}
                  when={education.graduation_year ? String(education.graduation_year) : null}
                  description={education.description}
                />
              ))}
            </Group>
          ) : null}

          {skills.length > 0 ? (
            <Group title="Skills">
              <ul aria-label="Skills" className="flex flex-wrap gap-2">
                {skills.map((skill) => (
                  <li
                    key={skill.name}
                    className="flex items-baseline gap-2 rounded-md bg-muted px-2 py-1 text-dense"
                  >
                    <span>{skill.name}</span>
                    <span className="text-meta text-muted-foreground">
                      {yearsOfExperience(skill.years_experience)}
                    </span>
                  </li>
                ))}
              </ul>
            </Group>
          ) : null}

          {spokenLanguages.length > 0 ? (
            <Group title="Languages">
              <ul aria-label="Languages" className="flex flex-wrap gap-x-6 gap-y-1 text-dense">
                {spokenLanguages.map((language) => (
                  <li key={language.code} className="flex items-baseline gap-2">
                    <span>{languageName(language.code)}</span>
                    <span className="text-meta text-muted-foreground">
                      {LANGUAGE_PROFICIENCY_LABELS[language.proficiency]}
                    </span>
                  </li>
                ))}
              </ul>
            </Group>
          ) : null}

          {projects.length > 0 ? (
            <Group title="Projects">
              {projects.map((project) => (
                <Entry
                  key={`${project.name}-${project.start_year}-${project.start_month}`}
                  title={
                    project.project_url ? (
                      <ExternalLink href={project.project_url}>{project.name}</ExternalLink>
                    ) : (
                      project.name
                    )
                  }
                  subtitle={
                    project.repository_url ? (
                      <ExternalLink href={project.repository_url}>
                        {linkLabel(project.repository_url)}
                      </ExternalLink>
                    ) : null
                  }
                  when={period(project)}
                  description={project.description}
                />
              ))}
            </Group>
          ) : null}

          {unmapped.length > 0 ? (
            <Group title="Other skills">
              <p className="text-meta text-muted-foreground">
                The platform has no Canonical name for these, so Screening never read them.
              </p>
              <ul aria-label="Other skills" className="flex flex-wrap gap-2">
                {unmapped.map((skill) => (
                  <li key={skill} className="rounded-md bg-muted px-2 py-1 text-dense">
                    {skill}
                  </li>
                ))}
              </ul>
            </Group>
          ) : null}
        </div>
      )}
    </ReviewCard>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-meta uppercase tracking-[0.08em] text-muted-foreground">{title}</h3>
      {children}
    </div>
  );
}

function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="underline underline-offset-4">
      {children}
    </a>
  );
}

interface EntryProps {
  title: ReactNode;
  subtitle?: ReactNode;
  when: string | null;
  description?: string | null;
}

function Entry({ title, subtitle, when, description }: EntryProps) {
  return (
    <div className="space-y-1 border-l-2 border-border pl-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4">
        <p className="font-medium text-foreground">{title}</p>
        {when ? <p className="text-meta text-muted-foreground">{when}</p> : null}
      </div>
      {subtitle ? <p className="text-dense text-muted-foreground">{subtitle}</p> : null}
      {description ? (
        <p className="max-w-prose text-dense whitespace-pre-line">{description}</p>
      ) : null}
    </div>
  );
}
