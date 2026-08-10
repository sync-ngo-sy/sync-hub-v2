import { CandidateCard, type CandidateFact } from '@sync/ui/components/candidate-card';
import { Badge } from '@sync/ui/components/ui/badge';
import type { ReactNode } from 'react';
import { useLanguageName } from '@/features/reference/hooks/use-languages';
import { ReviewCard } from '@/features/shell/components/review-card';
import {
  type FullProfile,
  LANGUAGE_PROFICIENCY_LABELS,
  linkLabel,
  period,
  profileIsBare,
  yearsOfExperience,
} from '../profile';

interface CandidateFactsCardProps {
  profile: FullProfile;
  facts: CandidateFact[];
  factsLabel: string;
}

export function CandidateFactsCard({ profile, facts, factsLabel }: CandidateFactsCardProps) {
  return (
    <CandidateCard
      name={profile.name}
      avatarUrl={profile.avatarUrl}
      email={profile.email}
      phone={profile.phone}
      canonicalRole={profile.role}
      headline={profile.headline}
      facts={facts}
      factsLabel={factsLabel}
      headingLevel={2}
    />
  );
}

interface CandidateProfileProps {
  profile: FullProfile;
  title: string;
  hint?: string;
  empty: string;
  children?: ReactNode;
}

export function CandidateProfile({ profile, title, hint, empty, children }: CandidateProfileProps) {
  const languageName = useLanguageName();

  return (
    <ReviewCard title={title} hint={hint}>
      <div className="space-y-(--space-section)">
        {profileIsBare(profile) ? (
          <p className="text-dense text-muted-foreground">{empty}</p>
        ) : (
          <>
            {profile.location || profile.summary ? (
              <div className="space-y-2">
                {profile.location ? (
                  <p className="text-meta text-muted-foreground">{profile.location}</p>
                ) : null}
                {profile.summary ? (
                  <p className="max-w-prose text-reading whitespace-pre-line">{profile.summary}</p>
                ) : null}
              </div>
            ) : null}

            {profile.experiences.length > 0 ? (
              <Group title="Experience">
                {profile.experiences.map((experience) => (
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

            {profile.educations.length > 0 ? (
              <Group title="Education">
                {profile.educations.map((education) => (
                  <Entry
                    key={`${education.institution}-${education.degree}-${education.field_of_study}-${education.graduation_year}`}
                    title={education.institution}
                    subtitle={[education.degree, education.field_of_study]
                      .filter(Boolean)
                      .join(', ')}
                    when={education.graduation_year ? String(education.graduation_year) : null}
                    description={education.description}
                  />
                ))}
              </Group>
            ) : null}

            {profile.skills.length > 0 ? (
              <Group title="Skills">
                <ul aria-label="Skills" className="flex flex-wrap gap-2">
                  {profile.skills.map((skill) => (
                    <li key={skill.name}>
                      <Badge variant="tag" size="sm">
                        <span>{skill.name}</span>
                        <span className="text-tag-foreground/80">
                          {yearsOfExperience(skill.years_experience)}
                        </span>
                      </Badge>
                    </li>
                  ))}
                </ul>
              </Group>
            ) : null}

            {profile.languages.length > 0 ? (
              <Group title="Languages">
                <ul aria-label="Languages" className="flex flex-wrap gap-x-6 gap-y-1 text-reading">
                  {profile.languages.map((language) => (
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

            {profile.projects.length > 0 ? (
              <Group title="Projects">
                {profile.projects.map((project) => (
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

            {profile.unmappedSkills.length > 0 ? (
              <Group title="Other skills">
                <ul aria-label="Other skills" className="flex flex-wrap gap-2">
                  {profile.unmappedSkills.map((skill) => (
                    <li key={skill}>
                      <Badge variant="tag" size="sm">
                        {skill}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </Group>
            ) : null}
          </>
        )}

        {children}
      </div>
    </ReviewCard>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-4">
      <h3 className="border-b border-input pb-2.5 font-heading text-title text-foreground">
        {title}
      </h3>
      <div className="space-y-5">{children}</div>
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
        <p className="text-reading font-medium text-foreground">{title}</p>
        {when ? <p className="text-meta tabular-nums text-muted-foreground">{when}</p> : null}
      </div>
      {subtitle ? <p className="text-dense text-muted-foreground">{subtitle}</p> : null}
      {description ? (
        <p className="max-w-prose text-reading whitespace-pre-line">{description}</p>
      ) : null}
    </div>
  );
}
