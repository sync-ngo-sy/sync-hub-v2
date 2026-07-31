import { Toaster as SonnerToaster } from 'sonner';
import { useTheme } from '@/lib/theme';

/** Sonner defaults to the light theme and has no idea ours changed, so it is told. */
export function Toaster() {
  const { theme } = useTheme();

  return <SonnerToaster theme={theme} position="bottom-center" closeButton />;
}
