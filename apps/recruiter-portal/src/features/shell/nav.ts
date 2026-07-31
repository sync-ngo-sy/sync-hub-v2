import { Briefcase, FileText, Inbox, LayoutDashboard, Settings, Star, Users } from 'lucide-react';
import type { ComponentType } from 'react';

export interface Destination {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
}

/** The seven destinations the approved Dashboard mockup fixes, in its order. */
export const DESTINATIONS: Destination[] = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/jobs', label: 'Jobs', icon: Briefcase },
  { to: '/applications', label: 'Applications', icon: Inbox },
  { to: '/candidates', label: 'Candidates', icon: Users },
  { to: '/talent-pool', label: 'Talent pool', icon: Star },
  { to: '/templates', label: 'Templates', icon: FileText },
  { to: '/settings', label: 'Settings', icon: Settings },
];
