export const REQUIREMENTS = [
  'cv',
  'full_name',
  'phone',
  'headline',
  'location',
  'canonical_role',
  'summary',
  'education',
  'skill',
  'language',
] as const;

export type Requirement = (typeof REQUIREMENTS)[number];

export interface ProfileFacts {
  has_a_read_cv?: boolean;
  full_name?: string | null;
  phone?: string | null;
  phone_country?: string | null;
  headline?: string | null;
  summary?: string | null;
  location_key?: string | null;
  canonical_role_key?: string | null;
  educations?: number;
  skills?: number;
  languages?: number;
}

const said = (value: string | null | undefined) =>
  value !== null && value !== undefined && value.trim() !== '';

export function missingRequirements(facts: ProfileFacts): Requirement[] {
  const met: Record<Requirement, boolean> = {
    cv: facts.has_a_read_cv === true,
    full_name: said(facts.full_name),
    phone: said(facts.phone) && said(facts.phone_country),
    headline: said(facts.headline),
    location: said(facts.location_key),
    canonical_role: said(facts.canonical_role_key),
    summary: said(facts.summary),
    education: (facts.educations ?? 0) > 0,
    skill: (facts.skills ?? 0) > 0,
    language: (facts.languages ?? 0) > 0,
  };
  return REQUIREMENTS.filter((requirement) => !met[requirement]);
}

export function completionPercent(missing: readonly Requirement[]): number {
  const total = REQUIREMENTS.length;
  const met = total - missing.length;
  return Math.floor((met * 100 + Math.floor(total / 2)) / total);
}
