import { Briefcase, FileText, Inbox, LayoutDashboard, Settings, Star, Users } from 'lucide-react';
import type { ComponentType } from 'react';
import type { FileRouteTypes } from '@/routeTree.gen';

export interface Destination {
  to: FileRouteTypes['to'];
  label: string;
  icon: ComponentType<{ className?: string }>;
}

export const DESTINATIONS: Destination[] = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/jobs', label: 'Jobs', icon: Briefcase },
  { to: '/applications', label: 'Applications', icon: Inbox },
  { to: '/candidates', label: 'Candidates', icon: Users },
  { to: '/talent-pool', label: 'Talent pool', icon: Star },
  { to: '/templates', label: 'Templates', icon: FileText },
  { to: '/settings', label: 'Settings', icon: Settings },
];
