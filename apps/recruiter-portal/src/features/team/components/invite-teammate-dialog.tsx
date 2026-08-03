import { zodResolver } from '@hookform/resolvers/zod';
import { FormField } from '@sync/ui/components/form-field';
import { Alert, AlertDescription, AlertTitle } from '@sync/ui/components/ui/alert';
import { Button } from '@sync/ui/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@sync/ui/components/ui/dialog';
import { Input } from '@sync/ui/components/ui/input';
import { Label } from '@sync/ui/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@sync/ui/components/ui/radio-group';
import { CircleAlert } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { useInviteMember } from '../hooks/use-member-actions';
import {
  type NewMember,
  RECRUITER_ROLES,
  type RecruiterRole,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
} from '../member';
import { inviteRejection } from '../rejection';
import { type InviteFormValues, inviteFormSchema } from '../schemas/invite';

const EMPTY_INVITE: InviteFormValues = { full_name: '', email: '', role: 'recruiter' };

interface InviteTeammateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InviteTeammateDialog({ open, onOpenChange }: InviteTeammateDialogProps) {
  const invite = useInviteMember();
  const form = useForm<InviteFormValues>({
    resolver: zodResolver(inviteFormSchema),
    defaultValues: EMPTY_INVITE,
  });

  const send = form.handleSubmit(async (values) => {
    const invited: NewMember = {
      full_name: values.full_name.trim(),
      email: values.email.trim(),
      role: values.role,
    };

    try {
      await invite.mutateAsync({ body: invited });
      toast.success(`Invitation sent to ${invited.email}`);
      form.reset(EMPTY_INVITE);
      onOpenChange(false);
    } catch (error) {
      const rejection = inviteRejection(error);
      for (const field of rejection.fields) form.setError(field.name, { message: field.message });
      if (rejection.root) form.setError('root', { message: rejection.root });
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={send} noValidate>
          <DialogHeader>
            <DialogTitle>Invite a teammate</DialogTitle>
            <DialogDescription>
              Sync emails them an invitation. They choose their own password, and join your Tenant
              once they have.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <FormField control={form.control} name="full_name" label="Full name">
              {(field) => <Input {...field} value={field.value} autoComplete="name" autoFocus />}
            </FormField>

            <FormField
              control={form.control}
              name="email"
              label="Email"
              description="Where the invitation goes. It becomes the address they sign in with."
            >
              {(field) => <Input {...field} value={field.value} type="email" autoComplete="off" />}
            </FormField>

            <FormField control={form.control} name="role" label="Role">
              {({ value, onChange, onBlur, name, ref, id, ...field }) => (
                <RadioGroup
                  {...field}
                  ref={ref}
                  name={name}
                  value={value}
                  onValueChange={(role) => onChange(role as RecruiterRole)}
                  onBlur={onBlur}
                  aria-label="Role"
                >
                  {RECRUITER_ROLES.map((role) => (
                    <div key={role} className="flex items-start gap-2">
                      <RadioGroupItem id={`${id}-${role}`} value={role} className="mt-1" />
                      <div className="space-y-0.5">
                        <Label htmlFor={`${id}-${role}`}>{ROLE_LABELS[role]}</Label>
                        <p className="text-meta text-muted-foreground">{ROLE_DESCRIPTIONS[role]}</p>
                      </div>
                    </div>
                  ))}
                </RadioGroup>
              )}
            </FormField>
          </div>

          {form.formState.errors.root?.message ? (
            <Alert className="mb-4">
              <CircleAlert aria-hidden="true" />
              <AlertTitle>Invitation not sent</AlertTitle>
              <AlertDescription>{form.formState.errors.root.message}</AlertDescription>
            </Alert>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              disabled={invite.isPending}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={invite.isPending}>
              {invite.isPending ? 'Sending invitation…' : 'Send invitation'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
