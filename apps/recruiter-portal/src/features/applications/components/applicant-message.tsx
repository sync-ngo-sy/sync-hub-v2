import { zodResolver } from '@hookform/resolvers/zod';
import { FormField } from '@sync/ui/components/form-field';
import { SkeletonText } from '@sync/ui/components/skeletons';
import { Alert, AlertDescription, AlertTitle } from '@sync/ui/components/ui/alert';
import { Button, buttonVariants } from '@sync/ui/components/ui/button';
import { Input } from '@sync/ui/components/ui/input';
import { Label } from '@sync/ui/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@sync/ui/components/ui/select';
import { Textarea } from '@sync/ui/components/ui/textarea';
import { Link } from '@tanstack/react-router';
import { CircleAlert, Mail, Send } from 'lucide-react';
import { useId, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { ReviewCard } from '@/features/shell/components/review-card';
import { messageDraft } from '@/features/templates/draft';
import { useMessageTemplates } from '@/features/templates/hooks/use-message-templates';
import type { MessageTemplate } from '@/features/templates/message-template';
import { type MessageWords, messageWordsSchema } from '@/features/templates/schemas/message-words';
import { useMyTenant } from '@/features/tenant/hooks/use-my-tenant';
import { problemDetail } from '@/lib/api-problem';
import { useMessageApplicant } from '../hooks/use-application-actions';

const SENT = 'Message queued — the candidate will have it shortly.';
const NOT_SENT = 'This message was not sent. Nothing reached the candidate.';

const NO_WORDS: MessageWords = { subject: '', body: '' };

const AS_SAVED =
  'The name here is the Snapshot’s. The send greets the candidate by the name on their profile today.';
const AS_EDITED = 'These words go exactly as they read here. The template keeps its own.';

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
  const form = useForm<MessageWords>({
    resolver: zodResolver(messageWordsSchema),
    defaultValues: NO_WORDS,
  });

  const available = templates.data ?? [];
  const picked = available.find((template) => template.id === templateId) ?? null;
  const tenantName = tenant.data?.name;
  const edited = form.formState.isDirty;

  function opens(template: MessageTemplate, filledBy: string): MessageWords {
    return messageDraft(template, {
      candidate_name: candidateName,
      job_title: jobTitle,
      tenant_name: filledBy,
    });
  }

  function choose(chosen: string | null) {
    setFailure(null);
    setTemplateId(chosen);
    const template = available.find((each) => each.id === chosen);
    form.reset(template && tenantName ? opens(template, tenantName) : NO_WORDS);
  }

  async function send(from: MessageTemplate, words: MessageWords) {
    setFailure(null);
    try {
      await sending.mutateAsync({
        params: { path: { application_id: applicationId } },
        body: { template_id: from.id, edited: edited ? words : null },
      });
      toast.success(SENT);
      setTemplateId(null);
      form.reset(NO_WORDS);
    } catch (error) {
      setFailure(problemDetail(error, NOT_SENT));
    }
  }

  return (
    <ReviewCard title="Message the applicant" icon={Mail}>
      {templates.isPending || !tenantName ? (
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
              onValueChange={choose}
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

          {picked ? (
            <form
              onSubmit={form.handleSubmit((words) => send(picked, words))}
              noValidate
              className="space-y-4"
            >
              <FormField control={form.control} name="subject" label="Subject">
                {(field) => <Input {...field} value={field.value} />}
              </FormField>

              <FormField control={form.control} name="body" label="Message">
                {(field) => <Textarea {...field} value={field.value} rows={10} />}
              </FormField>

              <p className="text-meta text-muted-foreground">{edited ? AS_EDITED : AS_SAVED}</p>

              <Button type="submit" className="w-full" disabled={sending.isPending}>
                <Send aria-hidden="true" />
                {sending.isPending ? 'Sending…' : 'Send this message'}
              </Button>
            </form>
          ) : (
            <p className="text-dense text-muted-foreground">
              Pick a template to read and edit it before you send it.
            </p>
          )}
        </div>
      )}
    </ReviewCard>
  );
}
