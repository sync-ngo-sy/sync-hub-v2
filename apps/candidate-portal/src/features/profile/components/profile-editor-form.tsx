import { zodResolver } from '@hookform/resolvers/zod';
import type { components } from '@sync/api-client/schema';
import { Button } from '@sync/ui/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@sync/ui/components/ui/card';
import { useBlocker } from '@tanstack/react-router';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { useSaveProfile } from '../hooks/use-save-profile';
import { applyServerErrors } from '../lib/apply-server-errors';
import { profileSchema, toFormValues, toProfile } from '../schemas/profile-schema';
import { CheckboxField, TextAreaField, TextField } from './profile-fields';
import {
  EducationSection,
  ExperienceSection,
  LanguageSection,
  ProjectSection,
  SkillSection,
  UnmappedSkillSection,
} from './profile-sections';

type CandidateProfile = components['schemas']['CandidateProfile'];

export function ProfileEditorForm({ profile }: { profile: CandidateProfile }) {
  const form = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: toFormValues(profile),
  });
  const { save, mutation } = useSaveProfile();

  const blocker = useBlocker({
    shouldBlockFn: () => form.formState.isDirty,
    enableBeforeUnload: () => form.formState.isDirty,
    withResolver: true,
  });

  const onSubmit = form.handleSubmit(async (values) => {
    form.clearErrors('root');
    try {
      const saved = await save(toProfile(values));
      form.reset(toFormValues(saved));
      toast.success('Profile saved');
    } catch (error) {
      const shownInForm = applyServerErrors(error, form.setError);
      if (!shownInForm) {
        toast.error("Something went wrong saving your profile. It hasn't been saved.");
      }
    }
  });

  const rootError = form.formState.errors.root?.message;

  return (
    <form className="space-y-8" onSubmit={onSubmit} noValidate>
      {blocker.status === 'blocked' ? (
        <div
          role="alertdialog"
          aria-label="Unsaved changes"
          className="rounded-lg border border-border bg-card p-4"
        >
          <p className="text-card-foreground text-sm">
            You have unsaved changes. Leave without saving?
          </p>
          <div className="mt-3 flex gap-2">
            <Button type="button" variant="destructive" size="sm" onClick={blocker.proceed}>
              Discard changes
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={blocker.reset}>
              Keep editing
            </Button>
          </div>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Basics</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <TextField
            control={form.control}
            name="full_name"
            label="Full name"
            autoComplete="name"
          />
          <TextField
            control={form.control}
            name="phone"
            label="Phone"
            type="tel"
            autoComplete="tel"
          />
          <TextField control={form.control} name="headline" label="Headline" />
          <TextField
            control={form.control}
            name="location"
            label="Location"
            autoComplete="address-level2"
          />
          <TextField
            control={form.control}
            name="preferred_language_code"
            label="Preferred language code"
            description="A recruiter search filter — an ISO code such as en or ar. Optional."
          />
          <TextAreaField control={form.control} name="summary" label="Summary" rows={4} />
          <CheckboxField
            control={form.control}
            name="is_searchable"
            label="List me in Sync's cross-tenant search"
            description="Requires a current, processed CV."
          />
        </CardContent>
      </Card>

      <ExperienceSection control={form.control} />
      <EducationSection control={form.control} />
      <SkillSection control={form.control} />
      <UnmappedSkillSection control={form.control} />
      <LanguageSection control={form.control} />
      <ProjectSection control={form.control} />

      {rootError ? (
        <p role="alert" className="text-destructive-foreground text-sm">
          {rootError}
        </p>
      ) : null}

      <div className="flex justify-end">
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'Saving…' : 'Save profile'}
        </Button>
      </div>
    </form>
  );
}
