import { describe, expect, it } from 'vitest';
import { CV_FAILURE_NOTIFICATION, MOVED_NOTIFICATION, READ_NOTIFICATION } from '@/testing/fixtures';
import { isUnread, notificationCopy } from './notification';

describe('what a notification says', () => {
  it('names the file the platform could not read, and leads to the CVs', () => {
    const copy = notificationCopy(CV_FAILURE_NOTIFICATION);

    expect(copy.headline).toBe("Couldn't read “scan.pdf”");
    expect(copy.detail).toBe('Open your CVs to see why, and upload another file.');
    expect(copy.to).toBe('/cvs');
  });

  it('names the Job, the employer and the move, and leads to the Application', () => {
    const copy = notificationCopy(MOVED_NOTIFICATION);

    expect(copy.headline).toBe('Frontend Developer (Remote) at Levant Digital');
    expect(copy.detail).toBe('Moved from Under review to Shortlisted.');
    expect(copy.to).toBe('/applications');
  });

  it("tells a status in the reader's words rather than the wire's", () => {
    const copy = notificationCopy(READ_NOTIFICATION);

    expect(copy.detail).toBe('Moved from Interview to Not selected.');
  });
});

describe('an unread notification', () => {
  it('is one nobody has opened yet', () => {
    expect(isUnread(MOVED_NOTIFICATION)).toBe(true);
    expect(isUnread(READ_NOTIFICATION)).toBe(false);
  });
});
