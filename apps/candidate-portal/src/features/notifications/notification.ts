import type { components } from '@sync/api-client';
import { CircleAlert, type LucideIcon, Send, Wand2 } from 'lucide-react';
import type { ProfileSearch } from '@/features/profile/search';
import type { FileRouteTypes } from '@/routeTree.gen';

export type Notification = components['schemas']['Notification'];

type ApplicationStage = components['schemas']['ApplicationStage'];

export const NOTIFICATIONS_PAGE_SIZE = 20;

export const RECENT_NOTIFICATIONS = 5;

export const NOTHING_YET =
  "Nothing yet. When one of your applications moves, or a CV has been read, or could not be, you'll hear about it here.";

export function isUnread(notification: Notification): boolean {
  return notification.read_at == null;
}

const STAGE_WORDS: Record<ApplicationStage, string> = {
  received: 'Received',
  in_review: 'In review',
  hired: 'Hired',
  not_selected: 'Not selected',
  withdrawn: 'Withdrawn',
};

export interface NotificationCopy {
  headline: string;
  detail: string;
  icon: LucideIcon;
  to: FileRouteTypes['to'];
  search?: ProfileSearch;
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
    case 'cv_parse_succeeded':
      return {
        headline: `“${payload.display_name}” has been read`,
        detail: 'Open your profile to fill the fields from it, and keep what is right.',
        icon: Wand2,
        to: '/profile',
        search: { fill: payload.cv_id },
      };
    case 'application_stage_changed':
      return {
        headline: `${payload.job_title} at ${payload.tenant_name}`,
        detail: `Moved from ${STAGE_WORDS[payload.previous_stage]} to ${STAGE_WORDS[payload.stage]}.`,
        icon: Send,
        to: '/applications',
      };
  }
}
