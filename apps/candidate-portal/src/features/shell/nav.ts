import { Search, Send, User } from 'lucide-react';
import type { ComponentType } from 'react';
import type { FileRouteTypes } from '@/routeTree.gen';

export interface Destination {
  to: FileRouteTypes['to'];
  label: string;
  icon: ComponentType<{ className?: string }>;
}

export const DESTINATIONS: Destination[] = [
  { to: '/jobs', label: 'Jobs', icon: Search },
  { to: '/applications', label: 'Applications', icon: Send },
  { to: '/profile', label: 'Profile', icon: User },
];
