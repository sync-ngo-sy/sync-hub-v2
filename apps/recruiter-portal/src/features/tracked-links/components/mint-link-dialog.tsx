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
import { CircleAlert } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { problemMessage } from '@/lib/api-problem';
import { useMintTrackedLink } from '../hooks/use-tracked-link-actions';
import { type LinkNameValues, linkNameSchema } from '../schemas/link-name';
import { type TrackedLink, trackedLinkAddress } from '../tracked-link';
import { CopyAddressButton } from './copy-address-button';

interface MintLinkDialogProps {
  jobId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MintLinkDialog({ jobId, open, onOpenChange }: MintLinkDialogProps) {
  const [minted, setMinted] = useState<TrackedLink | null>(null);
  const mint = useMintTrackedLink(jobId);
  const form = useForm<LinkNameValues>({
    resolver: zodResolver(linkNameSchema),
    defaultValues: { name: '' },
  });

  function change(next: boolean) {
    if (!next) {
      setMinted(null);
      form.reset({ name: '' });
    }
    onOpenChange(next);
  }

  const submit = form.handleSubmit(async (values) => {
    try {
      setMinted(
        await mint.mutateAsync({
          params: { path: { job_id: jobId } },
          body: { name: values.name.trim() },
        }),
      );
    } catch (error) {
      form.setError('root', { message: problemMessage(error, "This link couldn't be minted.") });
    }
  });

  return (
    <Dialog open={open} onOpenChange={change}>
      <DialogContent className="sm:max-w-lg">
        {minted ? (
          <>
            <DialogHeader>
              <DialogTitle>Tracked link minted</DialogTitle>
              <DialogDescription>
                Share this address. Every view it brings is counted against “{minted.name}”.
              </DialogDescription>
            </DialogHeader>

            <MintedAddress link={minted} />

            <DialogFooter>
              <Button type="button" onClick={() => change(false)}>
                Done
              </Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={submit} noValidate>
            <DialogHeader>
              <DialogTitle>Mint a tracked link</DialogTitle>
              <DialogDescription>
                Name the channel you are about to share it in. The name is how this Job's report
                tells one channel's traffic from another's.
              </DialogDescription>
            </DialogHeader>

            <div className="py-4">
              <FormField
                control={form.control}
                name="name"
                label="Name"
                description="Only your team sees it — a candidate opening the link sees the Job."
              >
                {(field) => (
                  <Input {...field} value={field.value} autoFocus placeholder="LinkedIn post" />
                )}
              </FormField>
            </div>

            {form.formState.errors.root?.message ? (
              <Alert className="mb-4">
                <CircleAlert aria-hidden="true" />
                <AlertTitle>Link not minted</AlertTitle>
                <AlertDescription>{form.formState.errors.root.message}</AlertDescription>
              </Alert>
            ) : null}

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                disabled={mint.isPending}
                onClick={() => change(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={mint.isPending}>
                {mint.isPending ? 'Minting…' : 'Mint link'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function MintedAddress({ link }: { link: TrackedLink }) {
  const address = trackedLinkAddress(link.token);

  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2">
      <span className="min-w-0 flex-1 truncate text-dense">{address}</span>
      <CopyAddressButton address={address} name={link.name} variant="outline" />
    </div>
  );
}
