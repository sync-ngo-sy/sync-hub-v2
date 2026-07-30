import { Briefcase, FileText, Inbox, LayoutDashboard, Settings, Star, Users } from 'lucide-react';

/** The workspace destinations, in the order the approved Dashboard mockup fixes. */
export const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/jobs', label: 'Jobs', icon: Briefcase },
  { to: '/applications', label: 'Applications', icon: Inbox },
  { to: '/candidates', label: 'Candidates', icon: Users },
  { to: '/talent-pool', label: 'Talent pool', icon: Star },
  { to: '/templates', label: 'Templates', icon: FileText },
  { to: '/settings', label: 'Settings', icon: Settings },
] as const;
