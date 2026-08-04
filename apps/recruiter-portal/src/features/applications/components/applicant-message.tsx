import { SkeletonText } from '@sync/ui/components/skeletons';
import { Alert, AlertDescription, AlertTitle } from '@sync/ui/components/ui/alert';
import { Button, buttonVariants } from '@sync/ui/components/ui/button';
import { Label } from '@sync/ui/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@sync/ui/components/ui/select';
import { Link } from '@tanstack/react-router';
import { CircleAlert, Send } from 'lucide-react';
import { useId, useState } from 'react';
import { toast } from 'sonner';
import { ReviewCard } from '@/features/shell/components/review-card';
import { useMessageTemplates } from '@/features/templates/hooks/use-message-templates';
import { messagePreview } from '@/features/templates/preview';
import { useMyTenant } from '@/features/tenant/hooks/use-my-tenant';
import { problemDetail } from '@/lib/api-problem';
import { useMessageApplicant } from '../hooks/use-application-actions';

const SENT = 'Message queued — the candidate will have it shortly.';
const NOT_SENT = 'This message was not sent. Nothing reached the candidate.';

interface ApplicantMessageProps {
  applicationId: string;
  candidateName: string;
  jobTitle: string;
}

export function ApplicantMessage({
  applicationId,
  candidateName,
  jobTitle,
}: ApplicantMessageProps) {
  const templates = useMessageTemplates();
  const tenant = useMyTenant();
  const sending = useMessageApplicant();
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const pickerId = useId();

  const available = templates.data ?? [];
  const picked = available.find((template) => template.id === templateId) ?? null;

  const preview =
    picked && tenant.data
      ? messagePreview(picked, {
          candidate_name: candidateName,
          job_title: jobTitle,
          tenant_name: tenant.data.name,
        })
      : null;

  async function send(chosen: string) {
    setFailure(null);
    try {
      await sending.mutateAsync({
        params: { path: { application_id: applicationId } },
        body: { template_id: chosen },
      });
      toast.success(SENT);
      setTemplateId(null);
    } catch (error) {
      setFailure(problemDetail(error, NOT_SENT));
    }
  }

  return (
    <ReviewCard
      title="Message the applicant"
      hint="One email, in words your Tenant has already agreed on."
    >
      {templates.isPending || tenant.isPending ? (
        <SkeletonText lines={3} />
      ) : available.length === 0 ? (
        <div className="space-y-3">
          <p className="text-dense text-muted-foreground">
            This Tenant has no Message template to send from yet.
          </p>
          <Link to="/templates" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            Write a Message template
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor={pickerId}>Message template</Label>
            <Select
              items={available.map((template) => ({
                value: template.id,
                label: template.name,
              }))}
              value={templateId}
              onValueChange={(value) => {
                setFailure(null);
                setTemplateId(value);
              }}
            >
              <SelectTrigger id={pickerId} className="w-full">
                <SelectValue placeholder="Pick a template" />
              </SelectTrigger>
              <SelectContent>
                {available.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {failure ? (
            <Alert>
              <CircleAlert aria-hidden="true" />
              <AlertTitle>Message not sent</AlertTitle>
              <AlertDescription>{failure}</AlertDescription>
            </Alert>
          ) : null}

          {picked && preview ? (
            <>
              <article
                aria-label="Message preview"
                className="space-y-2 rounded-lg border border-border bg-muted/40 p-3"
              >
                <p className="font-medium text-dense text-foreground">{preview.subject}</p>
                <p className="whitespace-pre-wrap text-dense text-muted-foreground">
                  {preview.body}
                </p>
              </article>

              <p className="text-meta text-muted-foreground">
                The name here is the Snapshot’s. The send greets the candidate by the name on their
                profile today.
              </p>

              <Button
                className="w-full"
                disabled={sending.isPending}
                onClick={() => void send(picked.id)}
              >
                <Send aria-hidden="true" />
                {sending.isPending ? 'Sending…' : 'Send this message'}
              </Button>
            </>
          ) : (
            <p className="text-dense text-muted-foreground">
              Pick a template to read it before you send it.
            </p>
          )}
        </div>
      )}
    </ReviewCard>
  );
}
