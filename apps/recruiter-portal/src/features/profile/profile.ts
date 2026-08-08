import type { components } from '@sync/api-client';
import { said } from '@/lib/said';

type CandidateRecord = components['schemas']['CandidateRecord'];
type ApplicationSnapshot = components['schemas']['ApplicationSnapshot'];
type LanguageProficiency = components['schemas']['LanguageProficiency'];

const UNNAMED = 'Unnamed candidate';

export interface FullProfile {
  name: string;
  avatarUrl: string | null;
  email: string | null;
  phone: string | null;
  headline: string | null;
  role: string | null;
  totalExperienceYears: number | null;
  location: string | null;
  summary: string | null;
  experiences: components['schemas']['ProfileExperience'][];
  educations: components['schemas']['ProfileEducation'][];
  skills: components['schemas']['ProfileSkill'][];
  languages: components['schemas']['ProfileLanguage'][];
  projects: components['schemas']['ProfileProject'][];
  unmappedSkills: string[];
}

export function recordProfile(record: CandidateRecord): FullProfile {
  return {
    name: said(record.full_name) ?? UNNAMED,
    avatarUrl: said(record.avatar_url),
    email: said(record.email),
    phone: said(record.phone),
    headline: said(record.headline),
    role: said(record.canonical_role_name),
    totalExperienceYears: record.total_experience_years,
    location: said(record.location_name),
    summary: said(record.summary),
    experiences: record.experiences ?? [],
    educations: record.educations ?? [],
    skills: record.skills ?? [],
    languages: record.languages ?? [],
    projects: record.projects ?? [],
    unmappedSkills: [],
  };
}

export function snapshotProfile(snapshot: ApplicationSnapshot): FullProfile {
  return {
    name: said(snapshot.full_name) ?? UNNAMED,
    avatarUrl: null,
    email: null,
    phone: said(snapshot.phone),
    headline: said(snapshot.headline),
    role: null,
    totalExperienceYears: snapshot.total_experience_years,
    location: said(snapshot.location),
    summary: said(snapshot.summary),
    experiences: snapshot.experiences ?? [],
    educations: snapshot.educations ?? [],
    skills: snapshot.skills ?? [],
    languages: snapshot.languages ?? [],
    projects: snapshot.projects ?? [],
    unmappedSkills: snapshot.unmapped_skills ?? [],
  };
}

export function profileIsBare(profile: FullProfile): boolean {
  return (
    !profile.summary &&
    !profile.location &&
    profile.experiences.length === 0 &&
    profile.educations.length === 0 &&
    profile.skills.length === 0 &&
    profile.languages.length === 0 &&
    profile.projects.length === 0 &&
    profile.unmappedSkills.length === 0
  );
}

export const LANGUAGE_PROFICIENCY_LABELS: Record<LanguageProficiency, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
  fluent: 'Fluent',
  native: 'Native',
};

const MONTH = new Intl.DateTimeFormat('en', { month: 'short', timeZone: 'UTC' });

export interface ProfilePeriod {
  start_year?: number | null;
  start_month?: number | null;
  end_year?: number | null;
  end_month?: number | null;
  is_current?: boolean;
}

function monthYear(
  year: number | null | undefined,
  month: number | null | undefined,
): string | null {
  if (year === null || year === undefined) return null;
  if (month === null || month === undefined || month < 1 || month > 12) return String(year);
  return `${MONTH.format(new Date(Date.UTC(2000, month - 1, 1)))} ${year}`;
}

export function period(entry: ProfilePeriod): string | null {
  const from = monthYear(entry.start_year, entry.start_month);
  const to = entry.is_current ? 'Present' : monthYear(entry.end_year, entry.end_month);
  if (from && to) return `${from} – ${to}`;
  return from ?? to ?? null;
}

export function linkLabel(url: string): string {
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
}

export function yearsOfExperience(years: number): string {
  if (years < 1) return 'Under a year';
  return years === 1 ? '1 year' : `${years} years`;
}
