import { TenantLogo } from '@sync/ui/components/tenant-logo';
import { Alert, AlertDescription, AlertTitle } from '@sync/ui/components/ui/alert';
import { Button } from '@sync/ui/components/ui/button';
import { CircleAlert, ImageUp } from 'lucide-react';
import { type ChangeEvent, useRef, useState } from 'react';
import { toast } from 'sonner';
import { isClientError, problemMessage } from '@/lib/api-problem';
import { logoUpload, useUploadLogo } from '../hooks/use-upload-logo';
import { LOGO_FILE_ACCEPT, LOGO_FORMATS, rejectionFor } from '../logo-check';

interface TenantLogoPickerProps {
  name: string;
  logoUrl: string | null;
}

export function TenantLogoPicker({ name, logoUrl }: TenantLogoPickerProps) {
  const upload = useUploadLogo();
  const input = useRef<HTMLInputElement>(null);
  const [refusal, setRefusal] = useState<string | null>(null);

  async function choose(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const rejected = rejectionFor(file);
    setRefusal(rejected);
    if (rejected) return;

    try {
      await upload.mutateAsync(logoUpload(file));
      toast.success('Logo saved.');
    } catch (error) {
      const message = problemMessage(error, "Your logo couldn't be saved. Try again.");
      if (isClientError(error)) setRefusal(message);
      else toast.error(message);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-4">
        <TenantLogo name={name} logoUrl={logoUrl} size="lg" />
        <div className="space-y-1">
          <Button
            type="button"
            variant="outline"
            disabled={upload.isPending}
            onClick={() => input.current?.click()}
          >
            <ImageUp aria-hidden="true" />
            {logoUrl ? 'Change logo' : 'Add a logo'}
          </Button>
          <p className="text-meta text-muted-foreground">
            {LOGO_FORMATS}. A square picture keeps all of itself; anything else keeps its middle.
          </p>
        </div>
      </div>

      {refusal ? (
        <Alert className="bg-muted">
          <CircleAlert aria-hidden="true" />
          <AlertTitle>That logo did not go through</AlertTitle>
          <AlertDescription>{refusal}</AlertDescription>
        </Alert>
      ) : null}

      <input
        ref={input}
        type="file"
        accept={LOGO_FILE_ACCEPT}
        aria-label="Choose a logo"
        className="sr-only"
        onChange={choose}
      />
    </div>
  );
}
