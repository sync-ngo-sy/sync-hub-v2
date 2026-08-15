import { type Control, useWatch } from 'react-hook-form';
import { isReady } from '@/features/cvs/cv';
import { useMyCvs } from '@/features/cvs/hooks/use-my-cvs';
import { completionPercent, missingRequirements, type Requirement } from '../completeness';
import type { ProfileFormValues } from '../schemas/profile';

const ANSWERS = [
  'full_name',
  'phone',
  'phone_country',
  'headline',
  'summary',
  'location_key',
  'canonical_role_key',
  'educations',
  'skills',
  'languages',
] as const satisfies readonly (keyof ProfileFormValues)[];

export interface ProfileProgress {
  /** Undefined until the CVs are known: one of the ten requirements is a CV nobody typed. */
  missing: readonly Requirement[] | undefined;
  percent: number;
}

export function useProfileProgress(control: Control<ProfileFormValues>): ProfileProgress {
  const cvs = useMyCvs();
  const [
    fullName,
    phone,
    phoneCountry,
    headline,
    summary,
    locationKey,
    roleKey,
    educations,
    skills,
    languages,
  ] = useWatch({ control, name: ANSWERS });

  if (cvs.data === undefined) return { missing: undefined, percent: 0 };

  const missing = missingRequirements({
    has_a_read_cv: cvs.data.some((cv) => cv.is_current && isReady(cv)),
    full_name: fullName,
    phone,
    phone_country: phoneCountry,
    headline,
    summary,
    location_key: locationKey,
    canonical_role_key: roleKey,
    educations: educations.length,
    skills: skills.length,
    languages: languages.length,
  });
  return { missing, percent: completionPercent(missing) };
}
