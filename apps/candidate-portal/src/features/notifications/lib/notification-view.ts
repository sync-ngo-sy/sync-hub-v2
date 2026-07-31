import type { components } from '@sync/api-client/schema';
import type { ChipStatus } from '@sync/ui/components/status-chip';

type NotificationPayload = components['schemas']['Notification']['payload'];

/** A notification reduced to the copy it shows and the in-app path it opens. */
export interface NotificationView {
  /** Root-relative path; navigated via `href`, so it need not (yet) be a typed route. */
  to: string;
  title: string;
  description: string;
  /** A status worth chipping, when the payload carries one. */
  status?: ChipStatus;
}

/** Turns a payload into what the UI renders. Exhaustive over the discriminated `type`. */
export function notificationView(payload: NotificationPayload): NotificationView {
  switch (payload.type) {
    case 'cv_parse_failed':
      return {
        to: '/cvs',
        title: "We couldn't read your CV",
        description: `Something went wrong reading ${payload.display_name}. Open your CVs to try another file.`,
      };
    case 'application_status_changed':
      return {
        to: '/applications',
        title: payload.job_title,
        description: `Your application to ${payload.tenant_name} changed status.`,
        status: payload.status,
      };
    default: {
      const unhandled: never = payload;
      throw new Error(`Unhandled notification payload: ${JSON.stringify(unhandled)}`);
    }
  }
}
