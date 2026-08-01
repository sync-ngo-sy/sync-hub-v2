#!/usr/bin/env bash
# Resets the staging database to the migration set. Refuses to touch production.
# See https://github.com/sync-ngo-sy/sync-hub-v2/issues/85
#
#   ./scripts/reset-staging-db.sh
#
# `supabase db reset --linked` is destructive and obeys whatever project happens to be
# linked, so the linked ref is checked against staging rather than trusted. Interactive by
# design.
#
# --no-seed because supabase/seed.sql holds local dev fixtures only. Reference data every
# environment needs ships as migration 11_seed_reference.sql and is reapplied by the reset.

set -uo pipefail

STAGING_REF=qjsqmtemyhvtnurohckb
PROD_REF=skmsobeqyljduzkjmokr
REF_FILE=supabase/.temp/project-ref

if [ ! -t 0 ]; then
  echo "REFUSING: no terminal attached. This drops every table in staging." >&2
  exit 77
fi

if [ ! -f "$REF_FILE" ]; then
  echo "no linked project. Run this from the repository root, after:" >&2
  echo "  supabase link --project-ref ${STAGING_REF}" >&2
  exit 66
fi

LINKED=$(tr -d '[:space:]' <"$REF_FILE")

if [ "$LINKED" = "$PROD_REF" ]; then
  echo "REFUSING: the linked project is PRODUCTION (${PROD_REF})." >&2
  echo "Link staging first: supabase link --project-ref ${STAGING_REF}" >&2
  exit 77
fi

if [ "$LINKED" != "$STAGING_REF" ]; then
  echo "REFUSING: linked project ${LINKED} is neither staging nor production." >&2
  echo "This script only resets ${STAGING_REF}." >&2
  exit 77
fi

echo "linked project : $LINKED (staging)"
echo "migrations     : $(find supabase/migrations -name '*.sql' | wc -l | tr -d ' ') files"
echo
echo "This drops every table in staging and replays the migration set."
printf "Type 'staging' to continue, anything else to abort: "
read -r REPLY
if [ "$REPLY" != "staging" ]; then
  echo "aborted; nothing was changed."
  exit 1
fi
echo

supabase db reset --linked --no-seed
