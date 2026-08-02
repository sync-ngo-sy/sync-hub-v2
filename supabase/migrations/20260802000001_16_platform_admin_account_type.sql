-- A third kind of Profile (ADR supabase-0003). The value lands in its own migration because
-- Postgres refuses to *use* a new enum value in the transaction that added it, and migration 17
-- pins it in a CHECK constraint.

alter type account_type add value 'platform_admin';
