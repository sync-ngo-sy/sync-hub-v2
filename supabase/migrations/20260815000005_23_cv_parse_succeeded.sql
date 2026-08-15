-- A read that worked is news too. It lands minutes after the upload, by which time the
-- Candidate is usually somewhere else, and what it found is theirs to review rather than the
-- platform's to save. The payload names the CV, so opening the Notification can fill the
-- profile from that one and no other.

alter type notification_type add value 'cv_parse_succeeded' before 'application_status_changed';
