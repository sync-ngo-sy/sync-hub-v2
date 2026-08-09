import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, AlertDescription, AlertTitle } from '@sync/ui/components/ui/alert';
import { Button } from '@sync/ui/components/ui/button';
import { useBlocker } from '@tanstack/react-router';
import { CircleAlert } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { CvsSection } from '@/features/cvs/components/cvs-section';
import { MAX_CVS } from '@/features/cvs/cv';
import { problemMessage } from '@/lib/api-problem';
import { useCvFill } from '../hooks/use-cv-fill';
import { useMyProfile } from '../hooks/use-my-profile';
import { useSaveProfile } from '../hooks/use-save-profile';
import { profileRejection } from '../rejection';
import { type ProfileFormValues, profileSchema, toFormValues, toProfile } from '../schemas/profile';
import { EducationsSection } from './educations-section';
import { ExperiencesSection } from './experiences-section';
import { FilledNotice } from './filled-notice';
import { IdentitySection } from './identity-section';
import { LanguagesSection } from './languages-section';
import { MyCandidateCard } from './my-candidate-card';
import { ProfileSection } from './profile-section';
import { ProjectsSection } from './projects-section';
import { SkillsSection } from './skills-section';
import { UnsavedChangesDialog } from './unsaved-changes-dialog';

export function ProfileEditor() {
  const { data: profile } = useMyProfile();
  const saveProfile = useSaveProfile();
  const {
    control,
    getValues,
    handleSubmit,
    reset,
    setError,
    formState: { dirtyFields, errors, isDirty, isSubmitting },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema, undefined, { raw: true }),
    mode: 'onTouched',
    defaultValues: toFormValues(profile),
  });
  const fill = useCvFill({ getValues, reset });

  const blocker = useBlocker({
    shouldBlockFn: () => isDirty,
    enableBeforeUnload: () => isDirty,
    withResolver: true,
  });

  const submit = handleSubmit(async (values) => {
    try {
      const saved = await saveProfile.mutateAsync({ body: toProfile(values) });
      reset(toFormValues(saved));
      fill.dismiss();
      toast.success('Profile saved.');
    } catch (error) {
      const rejection = profileRejection(error);
      if (!rejection) {
        toast.error(problemMessage(error, "Your profile couldn't be saved. Try again."));
        return;
      }
      for (const { name, message } of rejection.fields) setError(name, { message });
      if (rejection.root) setError('root', { message: rejection.root });
    }
  });

  return (
    <div className="space-y-6">
      <ProfileSection
        title="CVs"
        description={`Upload one and the fields below fill in from what it says. The current CV goes
          out with every application you send, and is the one recruiters searching the platform find
          you by. Keep up to ${MAX_CVS}.`}
      >
        <CvsSection onFill={fill.from} filling={fill.pending} />
      </ProfileSection>

      {fill.refusal ? (
        <Alert className="bg-muted">
          <CircleAlert aria-hidden="true" />
          <AlertTitle>That CV did not fill the form</AlertTitle>
          <AlertDescription>{fill.refusal}</AlertDescription>
        </Alert>
      ) : null}

      {fill.filledBy ? (
        <FilledNotice cvName={fill.filledBy} onUndo={fill.undo} onDismiss={fill.dismiss} />
      ) : null}

      <MyCandidateCard />

      <form onSubmit={submit} noValidate className="space-y-6">
        <IdentitySection control={control} />
        <ExperiencesSection control={control} experiencesDirty={Boolean(dirtyFields.experiences)} />
        <EducationsSection control={control} />
        <SkillsSection control={control} />
        <LanguagesSection control={control} />
        <ProjectsSection control={control} />

        {errors.root?.message ? (
          <Alert variant="destructive">
            <CircleAlert />
            <AlertTitle>Your profile was not saved</AlertTitle>
            <AlertDescription>{errors.root.message}</AlertDescription>
          </Alert>
        ) : null}

        <div className="sticky bottom-20 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-background px-4 py-3 md:bottom-4">
          <p className="text-dense text-muted-foreground" aria-live="polite">
            {isDirty ? 'Unsaved changes.' : 'Everything is saved.'}
          </p>
          <Button type="submit" size="lg" disabled={isSubmitting}>
            {isSubmitting ? 'Saving…' : 'Save profile'}
          </Button>
        </div>

        <UnsavedChangesDialog
          open={blocker.status === 'blocked'}
          onDiscard={() => blocker.proceed?.()}
          onKeepEditing={() => blocker.reset?.()}
        />
      </form>
    </div>
  );
}
