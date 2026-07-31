import { FileText, Search, Send, User } from 'lucide-react';
import type { ComponentType } from 'react';
import type { FileRouteTypes } from '@/routeTree.gen';

export interface Destination {
  to: FileRouteTypes['to'];
  label: string;
  icon: ComponentType<{ className?: string }>;
}

/** Four, because a fifth tab stops fitting at 360px; Notifications and Account settings are
 * in the account menu instead. */
export const DESTINATIONS: Destination[] = [
  { to: '/jobs', label: 'Jobs', icon: Search },
  { to: '/applications', label: 'Applications', icon: Send },
  { to: '/cvs', label: 'CVs', icon: FileText },
  { to: '/profile', label: 'Profile', icon: User },
];
