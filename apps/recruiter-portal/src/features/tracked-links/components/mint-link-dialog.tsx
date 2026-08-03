import { Button } from '@sync/ui/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@sync/ui/components/ui/dialog';
import { useState } from 'react';
import { useMintTrackedLink } from '../hooks/use-tracked-link-actions';
import { type TrackedLink, trackedLinkAddress } from '../tracked-link';
import { CopyAddressButton } from './copy-address-button';
import { LinkNameForm } from './link-name-form';

interface MintLinkDialogProps {
  jobId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MintLinkDialog({ jobId, open, onOpenChange }: MintLinkDialogProps) {
  const [minted, setMinted] = useState<TrackedLink | null>(null);
  const mint = useMintTrackedLink(jobId);

  function change(next: boolean) {
    if (!next) setMinted(null);
    onOpenChange(next);
  }

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
          <LinkNameForm
            title="Mint a tracked link"
            description="Name the channel you are about to share it in. The name is how this Job's report tells one channel's traffic from another's."
            defaultName=""
            fieldDescription="Only your team sees it — a candidate opening the link sees the Job."
            placeholder="LinkedIn post"
            submitLabel="Mint link"
            pendingLabel="Minting…"
            refusalTitle="Link not minted"
            refusalFallback="This link couldn't be minted."
            onSubmit={async (name) => {
              setMinted(
                await mint.mutateAsync({
                  params: { path: { job_id: jobId } },
                  body: { name },
                }),
              );
            }}
            onCancel={() => change(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function MintedAddress({ link }: { link: TrackedLink }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2">
      <span className="min-w-0 flex-1 truncate text-dense">{trackedLinkAddress(link.token)}</span>
      <CopyAddressButton link={link} variant="outline" />
    </div>
  );
}
