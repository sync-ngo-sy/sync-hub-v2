import { Search, Send, User } from 'lucide-react';
import type { ComponentType } from 'react';
import type { FileRouteTypes } from '@/routeTree.gen';

export interface Destination {
  to: FileRouteTypes['to'];
  label: string;
  icon: ComponentType<{ className?: string }>;
}

/** Few, because a fifth tab stops fitting at 360px; Notifications and Account settings are in
 * the account menu instead, and CVs are a section of the Profile rather than a destination. */
export const DESTINATIONS: Destination[] = [
  { to: '/jobs', label: 'Jobs', icon: Search },
  { to: '/applications', label: 'Applications', icon: Send },
  { to: '/profile', label: 'Profile', icon: User },
];
