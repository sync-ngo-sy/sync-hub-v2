import type { Requirement } from './completeness';
import type { ProfileFormValues } from './schemas/profile';

export type SectionId =
  | 'cvs'
  | 'about-you'
  | 'experience'
  | 'education'
  | 'skills'
  | 'other-skills'
  | 'languages'
  | 'projects'
  | 'links'
  | 'progress';

export interface Place {
  label: string;
  section: SectionId;
}

export const PLACES = {
  full_name: { label: 'Your name', section: 'about-you' },
  phone: { label: 'Phone', section: 'about-you' },
  phone_country: { label: 'Phone', section: 'about-you' },
  headline: { label: 'Headline', section: 'about-you' },
  location_key: { label: 'Location', section: 'about-you' },
  canonical_role_key: { label: 'What you do', section: 'about-you' },
  summary: { label: 'Summary', section: 'about-you' },
  is_searchable: { label: 'Let recruiters find me', section: 'progress' },
  experiences: { label: 'Experience', section: 'experience' },
  educations: { label: 'Education', section: 'education' },
  skills: { label: 'Skills', section: 'skills' },
  unmapped_skills: { label: 'Other skills', section: 'other-skills' },
  languages: { label: 'Languages', section: 'languages' },
  projects: { label: 'Projects', section: 'projects' },
  linkedin_url: { label: 'Links', section: 'links' },
  github_url: { label: 'Links', section: 'links' },
  portfolio_url: { label: 'Links', section: 'links' },
} as const satisfies Partial<Record<keyof ProfileFormValues, Place>>;

export type Named = keyof typeof PLACES;

export const NAMED_IN_ORDER = Object.keys(PLACES) as Named[];

const fieldsIn = (section: SectionId): readonly Named[] =>
  NAMED_IN_ORDER.filter((name) => PLACES[name].section === section);

export const FIELDS_IN: Record<SectionId, readonly Named[]> = {
  cvs: fieldsIn('cvs'),
  'about-you': fieldsIn('about-you'),
  experience: fieldsIn('experience'),
  education: fieldsIn('education'),
  skills: fieldsIn('skills'),
  'other-skills': fieldsIn('other-skills'),
  languages: fieldsIn('languages'),
  projects: fieldsIn('projects'),
  links: fieldsIn('links'),
  progress: fieldsIn('progress'),
};

export const REQUIREMENT_PLACES: Record<Requirement, Place> = {
  cv: { label: 'CV read', section: 'cvs' },
  full_name: PLACES.full_name,
  phone: PLACES.phone,
  headline: PLACES.headline,
  location: PLACES.location_key,
  canonical_role: PLACES.canonical_role_key,
  summary: PLACES.summary,
  education: PLACES.educations,
  skill: PLACES.skills,
  language: PLACES.languages,
};
