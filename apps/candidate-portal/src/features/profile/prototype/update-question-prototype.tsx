// PROTOTYPE for #369 — throwaway. Three variants of the profile editor on the real `/profile`
// route, switched with `?variant=A|B|C`. Real profile, real sections, real save bar; the CV upload
// and the save are stubs, because the question is what the portal asks, not whether the API works.
//
// A is the chosen one. B and C stay as the record of what it was judged against.

import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from '@tanstack/react-router';
import { type ReactNode, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { CompletionPanel } from '../components/completion-panel';
import { EducationsSection } from '../components/educations-section';
import { ExperiencesSection } from '../components/experiences-section';
import { IdentitySection } from '../components/identity-section';
import { LanguagesSection } from '../components/languages-section';
import { LinksSection } from '../components/links-section';
import { MyCandidateCard } from '../components/my-candidate-card';
import { ProfileSection } from '../components/profile-section';
import { ProjectsSection } from '../components/projects-section';
import { SkillsSection } from '../components/skills-section';
import { useMyProfile } from '../hooks/use-my-profile';
import { type ProfileFormValues, profileSchema, toFormValues } from '../schemas/profile';
import { whatIsUnanswered } from '../unanswered';
import { PrototypeSwitcher } from './prototype-switcher';
import { StubCvs } from './stub-cvs';
import { EMPTY_VALUES } from './stub-draft';
import type { Policy } from './update-stub';
import { useUpdateStub } from './use-update-stub';
import { NAME as NAME_A, VariantA } from './variant-a';
import { NAME as NAME_B, VariantB } from './variant-b';
import { NAME as NAME_C, VariantC } from './variant-c';

const ASK_ON_LANDING: Policy = { askAt: 'landing', remembers: false };
const ASK_ON_UPLOAD: Policy = { askAt: 'upload', remembers: true };

const VARIANTS = {
  A: { Chrome: VariantA, name: NAME_A, policy: ASK_ON_LANDING, chosen: true },
  B: { Chrome: VariantB, name: NAME_B, policy: ASK_ON_LANDING, chosen: false },
  C: { Chrome: VariantC, name: NAME_C, policy: ASK_ON_UPLOAD, chosen: false },
} as const;

export type VariantKey = keyof typeof VARIANTS;

export const VARIANT_KEYS = Object.keys(VARIANTS) as VariantKey[];

export default function UpdateQuestionPrototype({ variant }: { variant: VariantKey }) {
  const { Chrome, name, policy, chosen } = VARIANTS[variant];
  const { data: profile } = useMyProfile();
  const navigate = useNavigate();

  const {
    control,
    getValues,
    handleSubmit,
    reset,
    formState: { dirtyFields, isDirty, isSubmitting },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema, undefined, { raw: true }),
    mode: 'onTouched',
    defaultValues: toFormValues(profile),
  });

  const update = useUpdateStub(policy, { getValues, reset });
  const { restart, saved } = update;

  const scenario = useCallback(
    (firstUpload: boolean) => {
      reset(firstUpload ? EMPTY_VALUES : toFormValues(profile), { keepDefaultValues: true });
      restart(firstUpload);
    },
    [profile, reset, restart],
  );

  const submit = handleSubmit(
    async (values) => {
      await new Promise((done) => setTimeout(done, 600));
      reset(values, { keepDefaultValues: true });
      saved();
      toast.success('Profile saved. Nothing left the browser — this is a prototype.');
    },
    (errors) => toast.error(whatIsUnanswered(errors)),
  );

  const cvs = (offer?: ReactNode) => (
    <ProfileSection
      id="cvs"
      title="CVs"
      description="Upload one and it can update the fields below. The current CV goes out with every application."
      needed="One read CV needed to apply"
    >
      <StubCvs
        state={update.state}
        onUpload={update.upload}
        onUpdate={() => update.reply('update')}
        offer={offer}
      />
    </ProfileSection>
  );

  const fields = (
    <>
      <IdentitySection control={control} />
      <ExperiencesSection control={control} experiencesDirty={Boolean(dirtyFields.experiences)} />
      <EducationsSection control={control} />
      <SkillsSection control={control} />
      <LanguagesSection control={control} />
      <ProjectsSection control={control} />
      <LinksSection control={control} />
    </>
  );

  return (
    <>
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start lg:gap-(--space-grid)">
        <CompletionPanel control={control} />

        <div className="mt-6 min-w-0 space-y-6 pb-24 lg:col-start-1 lg:row-start-1 lg:mt-0">
          <Chrome
            update={update}
            cvs={cvs}
            card={<MyCandidateCard />}
            fields={fields}
            onSubmit={submit}
            isDirty={isDirty}
            isSubmitting={isSubmitting}
          />
        </div>
      </div>

      <PrototypeSwitcher
        variants={VARIANT_KEYS}
        current={variant}
        name={name}
        chosen={chosen}
        onSelect={(next) =>
          navigate({
            to: '/profile',
            search: (prev) => ({ ...prev, variant: next as VariantKey }),
            replace: true,
          })
        }
        state={update.state}
        onUpload={update.upload}
        onNotification={update.fromNotification}
        onScenario={scenario}
      />
    </>
  );
}
