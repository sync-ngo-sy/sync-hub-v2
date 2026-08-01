import type { components } from '@sync/api-client';
import { CircleAlert, type LucideIcon, Send } from 'lucide-react';
import type { FileRouteTypes } from '@/routeTree.gen';

export type Notification = components['schemas']['Notification'];

type ApplicationStatus = components['schemas']['ApplicationStatus'];

export const NOTIFICATIONS_PAGE_SIZE = 20;

/** The dropdown is a glance, not the page: five rows fit a phone without becoming a list. */
export const RECENT_NOTIFICATIONS = 5;

/** One sentence for one emptiness, wherever the reader meets it. */
export const NOTHING_YET =
  "Nothing yet. When one of your applications moves, or a CV can't be read, you'll hear about it here.";

export function isUnread(notification: Notification): boolean {
  return notification.read_at == null;
}

/** The reader's words for where an Application stands. `rejected` is the wire's verdict, not a
 * sentence anybody should be told in. */
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
  /** Where the news can be read in full — every payload type has somewhere to go. */
  to: FileRouteTypes['to'];
}

/** The one switch over `payload.type`, so a payload type the platform starts sending is a
 * compile error here and nowhere else. */
export function notificationCopy({ payload }: Notification): NotificationCopy {
  switch (payload.type) {
    case 'cv_parse_failed':
      return {
        headline: `Couldn't read “${payload.display_name}”`,
        detail: 'Open your CVs to see why, and upload another file.',
        icon: CircleAlert,
        to: '/cvs',
      };
    case 'application_status_changed':
      return {
        headline: `${payload.job_title} at ${payload.tenant_name}`,
        detail: `Moved from ${STATUS_WORDS[payload.previous_status]} to ${STATUS_WORDS[payload.status]}.`,
        icon: Send,
        // My Applications is where a Candidate follows an Application — there is no page for one
        // on its own, which is why `payload.application_id` has nowhere to point.
        to: '/applications',
      };
  }
}
