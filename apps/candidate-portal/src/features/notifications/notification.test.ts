import { describe, expect, it } from 'vitest';
import {
  CV_FAILURE_NOTIFICATION,
  CV_READ_NOTIFICATION,
  MOVED_NOTIFICATION,
  READ_NOTIFICATION,
  READY_CV,
} from '@/testing/fixtures';
import { isUnread, notificationCopy } from './notification';

describe('what a notification says', () => {
  it('names the file the platform could not read, and leads to the profile it sits on', () => {
    const copy = notificationCopy(CV_FAILURE_NOTIFICATION);

    expect(copy.headline).toBe("Couldn't read “scan.pdf”");
    expect(copy.detail).toBe('Open your profile to see why, and upload another file.');
    expect(copy.to).toBe('/profile');
  });

  it('names the CV that was read, and leads to the profile it fills', () => {
    const copy = notificationCopy(CV_READ_NOTIFICATION);

    expect(copy.headline).toBe('“lina-khoury-2024.docx” has been read');
    expect(copy.detail).toBe(
      'Open your profile to fill the fields from it, and keep what is right.',
    );
    expect(copy.to).toBe('/profile');
    expect(copy.search).toEqual({ fill: READY_CV.id });
  });

  it('names the Job, the employer and the Stage it reached, and leads to the Application', () => {
    const copy = notificationCopy(MOVED_NOTIFICATION);

    expect(copy.headline).toBe('Frontend Developer (Remote) at Levant Digital');
    expect(copy.detail).toBe('Moved from Received to In review.');
    expect(copy.to).toBe('/applications');
  });

  it("tells a Stage in the reader's words rather than the wire's", () => {
    const copy = notificationCopy(READ_NOTIFICATION);

    expect(copy.detail).toBe('Moved from In review to Not selected.');
  });
});

describe('an unread notification', () => {
  it('is one nobody has opened yet', () => {
    expect(isUnread(MOVED_NOTIFICATION)).toBe(true);
    expect(isUnread(READ_NOTIFICATION)).toBe(false);
  });
});
