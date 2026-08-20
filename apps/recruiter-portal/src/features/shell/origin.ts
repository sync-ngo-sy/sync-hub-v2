import type { ApplicationFilters, TenantApplicationFilters } from '@/features/applications/reading';
import type { CandidatesReading } from '@/features/candidates/reading';

const SECTIONS = ['dashboard', 'jobs', 'applications', 'candidates', 'talent-pool', 'job'] as const;

type Section = (typeof SECTIONS)[number];

export type Origin = { at: Section } | { at: 'application'; applicationId: string };

export type CrumbTarget =
  | { at: 'dashboard' }
  | { at: 'jobs' }
  | { at: 'applications'; reading: TenantApplicationFilters }
  | { at: 'candidates'; reading: CandidatesReading }
  | { at: 'talent-pool' }
  | { at: 'job'; jobId: string; reading: ApplicationFilters }
  | { at: 'application'; applicationId: string };

export interface Crumb {
  label: string;
  target?: CrumbTarget;
}

function isSection(value: string): value is Section {
  return (SECTIONS as readonly string[]).includes(value);
}

export function originAddress(origin: Origin): string {
  return origin.at === 'application' ? `application.${origin.applicationId}` : origin.at;
}

export function originFrom(value: string | undefined): Origin | null {
  if (!value) return null;

  const [at, id = ''] = value.split('.');
  if (at === 'application') return id ? { at, applicationId: id } : null;

  return at && isSection(at) ? { at } : null;
}

interface ApplicationLeaf {
  name: string;
  job: { id: string; title: string };
  reading: TenantApplicationFilters;
}

export function applicationTrail(origin: Origin | null, leaf: ApplicationLeaf): Crumb[] {
  switch (origin?.at) {
    case 'job':
      return [
        { label: 'Jobs', target: { at: 'jobs' } },
        {
          label: leaf.job.title,
          target: { at: 'job', jobId: leaf.job.id, reading: leaf.reading },
        },
        { label: leaf.name },
      ];
    case 'dashboard':
      return [{ label: 'Dashboard', target: { at: 'dashboard' } }, { label: leaf.name }];
    default:
      return [
        { label: 'Applications', target: { at: 'applications', reading: leaf.reading } },
        { label: leaf.name },
      ];
  }
}

interface CandidateLeaf {
  name: string;
  reading: CandidatesReading;
}

export function candidateTrail(origin: Origin | null, leaf: CandidateLeaf): Crumb[] {
  switch (origin?.at) {
    case 'talent-pool':
      return [{ label: 'Talent pool', target: { at: 'talent-pool' } }, { label: leaf.name }];
    case 'application':
      return [
        { label: 'Applications', target: { at: 'applications', reading: {} } },
        {
          label: leaf.name,
          target: { at: 'application', applicationId: origin.applicationId },
        },
        { label: 'Live profile' },
      ];
    default:
      return [
        { label: 'Candidates', target: { at: 'candidates', reading: leaf.reading } },
        { label: leaf.name },
      ];
  }
}

export function jobTrail(title: string): Crumb[] {
  return [{ label: 'Jobs', target: { at: 'jobs' } }, { label: title }];
}
