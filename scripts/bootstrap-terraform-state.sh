#!/usr/bin/env bash
# One-time: creates the bucket that holds Terraform state.
# See https://github.com/sync-ngo-sy/sync-hub-v2/issues/83 and infra/terraform/README.md
#
#   ./scripts/bootstrap-terraform-state.sh
#
# The bucket cannot be managed by the state it holds, so it is created here instead of in
# Terraform. Versioned, so a corrupted or truncated state file can be rolled back.
# Re-running is safe.

set -uo pipefail

PROJECT=sync-ngo-prod
BUCKET=sync-ngo-tfstate
LOCATION=europe-west3

echo "project : $PROJECT"
echo "bucket  : gs://$BUCKET"
echo "location: $LOCATION"
echo

if gcloud storage buckets describe "gs://${BUCKET}" --project="$PROJECT" >/dev/null 2>&1; then
  echo "exists: gs://${BUCKET}"
else
  gcloud storage buckets create "gs://${BUCKET}" \
    --project="$PROJECT" \
    --location="$LOCATION" \
    --uniform-bucket-level-access \
    --public-access-prevention || exit 1
fi

gcloud storage buckets update "gs://${BUCKET}" --versioning || exit 1

echo
gcloud storage buckets describe "gs://${BUCKET}" \
  --format="value(name, location, versioning_enabled, public_access_prevention, uniform_bucket_level_access)"
