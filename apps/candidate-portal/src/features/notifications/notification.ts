import type { components } from '@sync/api-client';
import { CircleAlert, type LucideIcon, Send } from 'lucide-react';
import type { FileRouteTypes } from '@/routeTree.gen';

export type Notification = components['schemas']['Notification'];

type ApplicationStatus = components['schemas']['ApplicationStatus'];

export const NOTIFICATIONS_PAGE_SIZE = 20;

export const RECENT_NOTIFICATIONS = 5;

export const NOTHING_YET =
  "Nothing yet. When one of your applications moves, or a CV can't be read, you'll hear about it here.";

export function isUnread(notification: Notification): boolean {
  return notification.read_at == null;
}

const STATUS_WORDS: Record<ApplicationStatus, string> = {
  new: 'New',
  reviewing: 'Under review',
  shortlisted: 'Shortlisted',
  interview: 'Interview',
  offer: 'Offer',
  hired: 'Hired',
  rejected: 'Not selected',
  withdrawn: 'Withdrawn',
};

export interface NotificationCopy {
  headline: string;
  detail: string;
  icon: LucideIcon;
  to: FileRouteTypes['to'];
}

export function notificationCopy({ payload }: Notification): NotificationCopy {
  switch (payload.type) {
    case 'cv_parse_failed':
      return {
        headline: `Couldn't read “${payload.display_name}”`,
        detail: 'Open your profile to see why, and upload another file.',
        icon: CircleAlert,
        to: '/profile',
      };
    case 'application_status_changed':
      return {
        headline: `${payload.job_title} at ${payload.tenant_name}`,
        detail: `Moved from ${STATUS_WORDS[payload.previous_status]} to ${STATUS_WORDS[payload.status]}.`,
        icon: Send,
        to: '/applications',
      };
  }
}
