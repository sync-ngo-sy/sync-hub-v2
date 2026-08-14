-- Where a Candidate came from, when it was not their own doing.
--
-- The migration in `scripts/manatal-migration` makes an account per Manatal candidate, and
-- nothing in the schema would otherwise say so: they look exactly like somebody who signed up.
-- A Recruiter reading one needs to know, because it changes what the record means — nobody typed
-- this profile, and the address on it has never been confirmed by the person behind it.
--
-- Whether the account has since been **claimed** is deliberately not a column. `auth.users`
-- already knows: an account somebody has signed into has a `last_sign_in_at`, and one nobody has
-- taken over does not. Storing that again would mean a second writer, on the one flow least
-- worth putting a write into, and two answers that can disagree.
--
-- Named for Manatal rather than for imports in general because that is what exists. A second
-- source would turn this into `imported_from text`, which is a one-line migration on the day
-- there is a second source and speculation until then.

alter table candidates
  add column is_imported_from_manatal boolean not null default false;

comment on column candidates.is_imported_from_manatal is
  'True where scripts/manatal-migration created this Candidate rather than the person signing '
  'up. Whether they have since claimed the account is auth.users.last_sign_in_at, not a column.';
