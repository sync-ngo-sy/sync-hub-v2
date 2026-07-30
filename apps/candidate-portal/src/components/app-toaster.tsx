import { Toaster } from 'sonner';
import { useTheme } from '../lib/theme';

export function AppToaster() {
  const { theme } = useTheme();
  return <Toaster theme={theme} closeButton />;
}
