import { Building2, LayoutDashboard, UserPlus } from 'lucide-react';
import type { ComponentType } from 'react';

export interface Destination {
  to: '/overview' | '/access-requests' | '/tenants';
  label: string;
  icon: ComponentType<{ className?: string }>;
}

export const DESTINATIONS: Destination[] = [
  { to: '/overview', label: 'Overview', icon: LayoutDashboard },
  { to: '/access-requests', label: 'Access requests', icon: UserPlus },
  { to: '/tenants', label: 'Tenants', icon: Building2 },
];
