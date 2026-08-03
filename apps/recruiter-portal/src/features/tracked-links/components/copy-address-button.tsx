import { Button } from '@sync/ui/components/ui/button';
import { Copy } from 'lucide-react';
import { toast } from 'sonner';

interface CopyAddressButtonProps {
  address: string;
  name: string;
  variant?: 'ghost' | 'outline';
}

export function CopyAddressButton({ address, name, variant = 'ghost' }: CopyAddressButtonProps) {
  async function copy() {
    try {
      await navigator.clipboard.writeText(address);
      toast.success('Address copied');
    } catch {
      toast.error('This browser would not let us copy — select the address and copy it yourself.');
    }
  }

  return (
    <Button
      type="button"
      variant={variant}
      size="sm"
      aria-label={`Copy the address for ${name}`}
      onClick={() => void copy()}
    >
      <Copy aria-hidden="true" />
      Copy
    </Button>
  );
}
