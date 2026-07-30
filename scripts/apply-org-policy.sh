#!/usr/bin/env bash
# Applies one organisation-policy file from infra/org-policies/.
# See https://github.com/sync-ngo-sy/sync-hub-v2/issues/76 and infra/org-policies/README.md
#
#   ./scripts/apply-org-policy.sh infra/org-policies/project-sync-ngo-prod.yaml
#
# The script refuses organisation-scoped files. The organisation baseline is a record of
# what is enforced, not something tooling should be able to rewrite — an apply that could
# reach it would make this repository the most privileged thing in the account.
#
# Needs roles/orgpolicy.policyAdmin on the active account (organizationAdmin is not
# enough) and orgpolicy.googleapis.com enabled on the target project. The README explains
# both.

set -uo pipefail

FILE="${1:-}"

if [ -z "$FILE" ]; then
  echo "usage: $0 <policy-file.yaml>" >&2
  exit 64
fi

if [ ! -f "$FILE" ]; then
  echo "no such file: $FILE" >&2
  exit 66
fi

# ---------------------------------------------------------------- parse --------
POLICY_NAME=$(awk -F': *' '/^name:/ { gsub(/["'\'']/, "", $2); print $2; exit }' "$FILE")

if [ -z "$POLICY_NAME" ]; then
  echo "$FILE has no top-level 'name:' — is it an org-policy file?" >&2
  exit 65
fi

CONTAINER_TYPE=${POLICY_NAME%%/*}
CONTAINER_ID=$(printf '%s' "$POLICY_NAME" | cut -d/ -f2)
CONSTRAINT=${POLICY_NAME##*/}

# ---------------------------------------------------------------- guard --------
if [ "$CONTAINER_TYPE" != "projects" ]; then
  echo "REFUSING: $FILE targets '$CONTAINER_TYPE/$CONTAINER_ID'." >&2
  echo "Only project-scoped policies are applied from this repository. Organisation-wide" >&2
  echo "policies are recorded, not applied — see infra/org-policies/README.md." >&2
  exit 77
fi

if [ ! -t 0 ]; then
  echo "REFUSING: no terminal attached. This script is deliberately interactive." >&2
  exit 77
fi

echo "file       : $FILE"
echo "constraint : $CONSTRAINT"
echo "project    : $CONTAINER_ID"
echo "account    : $(gcloud config get-value account 2>/dev/null)"
echo

# ---------------------------------------------------------------- before -------
echo "--- EFFECTIVE POLICY NOW ---"
gcloud org-policies describe "$CONSTRAINT" --project="$CONTAINER_ID" --effective 2>&1 | sed 's/^/  /'
echo

echo "--- TO BE APPLIED ---"
sed 's/^/  /' "$FILE"
echo

# ---------------------------------------------------------------- confirm ------
printf 'Apply this policy to project %s? [y/N] ' "$CONTAINER_ID"
read -r REPLY
case "$REPLY" in
  y | Y) ;;
  *)
    echo "aborted; nothing was written."
    exit 1
    ;;
esac
echo

if ! gcloud org-policies set-policy "$FILE"; then
  echo >&2
  echo "set-policy failed. The two usual causes are a missing roles/orgpolicy.policyAdmin" >&2
  echo "on $(gcloud config get-value account 2>/dev/null), and orgpolicy.googleapis.com not" >&2
  echo "being enabled on $CONTAINER_ID. See infra/org-policies/README.md." >&2
  exit 1
fi

# ---------------------------------------------------------------- after --------
echo
echo "--- EFFECTIVE POLICY AFTER ---"
gcloud org-policies describe "$CONSTRAINT" --project="$CONTAINER_ID" --effective 2>&1 | sed 's/^/  /'
echo
echo "Propagation is usually seconds but is documented at up to ~15 minutes."
echo "Verify with the Cloud Run probe in infra/org-policies/README.md."
