import { SkeletonText } from '@sync/ui/components/skeletons';
import { Button } from '@sync/ui/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@sync/ui/components/ui/dialog';
import { Input } from '@sync/ui/components/ui/input';
import { Label } from '@sync/ui/components/ui/label';
import { type ReactNode, useState } from 'react';
import { toast } from 'sonner';
import { draftToProfile, type ProfileDraft, skillNeedsYears } from '../draft';
import { useApplyDraft } from '../hooks/use-apply-draft';
import { useProfileDraft } from '../hooks/use-profile-draft';

interface DraftReviewDialogProps {
  cvId: string | null;
  cvName: string | null;
  onOpenChange: (open: boolean) => void;
}

export function DraftReviewDialog({ cvId, cvName, onOpenChange }: DraftReviewDialogProps) {
  return (
    <Dialog open={cvId != null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Review profile draft</DialogTitle>
          <DialogDescription>
            {cvName
              ? `What Sync read from ${cvName}. Applying replaces your current profile with this.`
              : 'Applying replaces your current profile with this.'}
          </DialogDescription>
        </DialogHeader>
        {cvId ? <DraftBody cvId={cvId} onApplied={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function DraftBody({ cvId, onApplied }: { cvId: string; onApplied: () => void }) {
  const draftQuery = useProfileDraft(cvId);
  const { applyDraft, mutation } = useApplyDraft();
  const [skillYears, setSkillYears] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);

  if (draftQuery.isPending) {
    return <SkeletonText lines={5} />;
  }

  if (draftQuery.isError || !draftQuery.data) {
    return (
      <div className="space-y-3">
        <p role="alert" className="text-sm text-destructive-foreground">
          We couldn't build a draft from this CV yet. It may still be reading.
        </p>
        <DialogFooter>
          <DialogClose render={<Button variant="outline">Close</Button>} />
        </DialogFooter>
      </div>
    );
  }

  const draft = draftQuery.data;

  async function onApply() {
    setError(null);
    try {
      await applyDraft(draftToProfile(draft, skillYears));
      toast.success('Profile updated from your CV.');
      onApplied();
    } catch {
      setError("That didn't apply. Check the highlighted skills and try again.");
    }
  }

  return (
    <div className="space-y-4">
      <DraftSummary draft={draft} skillYears={skillYears} onSkillYears={setSkillYears} />
      {error ? (
        <p role="alert" className="text-sm text-destructive-foreground">
          {error}
        </p>
      ) : null}
      <DialogFooter>
        <DialogClose render={<Button variant="outline">Cancel</Button>} />
        <Button disabled={mutation.isPending} onClick={onApply}>
          Apply to profile
        </Button>
      </DialogFooter>
    </div>
  );
}

function DraftSummary({
  draft,
  skillYears,
  onSkillYears,
}: {
  draft: ProfileDraft;
  skillYears: Record<string, number>;
  onSkillYears: (next: Record<string, number>) => void;
}) {
  return (
    <dl className="max-h-[60dvh] space-y-4 overflow-y-auto text-sm">
      <Row label="Name" value={draft.full_name} />
      {draft.headline ? <Row label="Headline" value={draft.headline} /> : null}
      {draft.location ? <Row label="Location" value={draft.location} /> : null}
      {draft.summary ? <Row label="Summary" value={draft.summary} /> : null}

      {draft.experiences?.length ? (
        <Section label="Experience">
          {draft.experiences.map((experience) => (
            <li
              key={`${experience.job_title}-${experience.company_name ?? ''}-${experience.start_year ?? ''}`}
            >
              {experience.job_title}
              {experience.company_name ? ` — ${experience.company_name}` : ''}
            </li>
          ))}
        </Section>
      ) : null}

      {draft.educations?.length ? (
        <Section label="Education">
          {draft.educations.map((education) => (
            <li
              key={`${education.institution}-${education.degree ?? ''}-${education.graduation_year ?? ''}`}
            >
              {education.institution}
              {education.degree ? ` — ${education.degree}` : ''}
            </li>
          ))}
        </Section>
      ) : null}

      {draft.languages?.length ? (
        <Section label="Languages">
          {draft.languages.map((language) => (
            <li key={language.code}>{language.code}</li>
          ))}
        </Section>
      ) : null}

      {draft.skills?.length ? (
        <div>
          <dt className="font-medium text-foreground">Skills</dt>
          <dd className="mt-2 space-y-2">
            {draft.skills.map((skill) =>
              skillNeedsYears(skill) ? (
                <div key={skill.name} className="flex items-center gap-2">
                  <Label htmlFor={`years-${skill.name}`} className="min-w-40 text-muted-foreground">
                    {skill.name}
                  </Label>
                  <Input
                    id={`years-${skill.name}`}
                    type="number"
                    min={0}
                    step={0.5}
                    className="h-8 w-24"
                    aria-label={`Years of experience for ${skill.name}`}
                    placeholder="Years"
                    value={skillYears[skill.name] ?? ''}
                    onChange={(event) =>
                      onSkillYears({
                        ...skillYears,
                        [skill.name]: Number(event.target.value) || 0,
                      })
                    }
                  />
                </div>
              ) : (
                <div key={skill.name} className="text-muted-foreground">
                  {skill.name} — {skill.years_experience} yr
                </div>
              ),
            )}
          </dd>
        </div>
      ) : null}
    </dl>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-4">
      <dt className="min-w-28 font-medium text-foreground">{label}</dt>
      <dd className="text-muted-foreground">{value}</dd>
    </div>
  );
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="font-medium text-foreground">{label}</dt>
      <dd>
        <ul className="mt-1 list-inside list-disc space-y-1 text-muted-foreground">{children}</ul>
      </dd>
    </div>
  );
}
