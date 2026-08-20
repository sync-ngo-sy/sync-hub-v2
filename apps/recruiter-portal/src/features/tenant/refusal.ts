import { isProblem } from '@/lib/api-problem';
import { RECRUITER_DEACTIVATED_PROBLEM, TENANT_SUSPENDED_PROBLEM } from './problems';

export type AccessRefusal = 'recruiter-deactivated' | 'tenant-suspended';

export function accessRefusal(problem: unknown): AccessRefusal | null {
  if (isProblem(problem, RECRUITER_DEACTIVATED_PROBLEM)) return 'recruiter-deactivated';
  if (isProblem(problem, TENANT_SUSPENDED_PROBLEM)) return 'tenant-suspended';
  return null;
}
