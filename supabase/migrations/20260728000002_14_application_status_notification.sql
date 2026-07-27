-- Pipeline states are what the Candidate is told about in-app. The rejection a human decided
-- also reaches them by email, which needs nothing here: `communication_type` already spells
-- `application_rejection`.

alter type notification_type add value 'application_status_changed';
