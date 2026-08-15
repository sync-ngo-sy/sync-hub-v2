-- The Phone travels with the Application as the country and the number it was that day. An
-- Application is read long after the Candidate has moved countries, and half a frozen answer is
-- not one.
--
-- The same shape the live columns hold, because a Snapshot cannot contain something a profile
-- could not.
--
-- `not valid` for the same two, and for a second reason as well: a Snapshot is written once and
-- never rewritten -- a trigger refuses every update on this table, the service role included -- so
-- an Application that arrived with a country-less number cannot be corrected and must not be.
-- It stays exactly as it was read; every Snapshot from here on carries both.

alter table application_profile_snapshots
  add column phone_country text;

alter table application_profile_snapshots
  add constraint asnap_phone_is_e164
    check (phone ~ '^\+[1-9][0-9]{1,14}$') not valid,
  add constraint asnap_phone_has_a_country
    check (num_nonnulls(phone, phone_country) <> 1) not valid,
  add constraint asnap_phone_country_is_iso
    check (phone_country ~ '^[A-Z]{2}$');
