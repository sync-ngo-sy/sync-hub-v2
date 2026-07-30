#!/usr/bin/env bash
# Applies one organisation-policy file from infra/org-policies/.
# See https://github.com/sync-ngo-sy/sync-hub-v2/issues/76 and infra/org-policies/README.md
#
#   ./scripts/apply-org-policy.sh --check infra/org-policies/project-sync-ngo-prod.yaml
#   ./scripts/apply-org-policy.sh infra/org-policies/project-sync-ngo-prod.yaml
#   ./scripts/apply-org-policy.sh --yes infra/org-policies/project-sync-ngo-prod.yaml
#
#   --check  parse and validate only; makes no cloud calls at all. This is what CI runs
#            on a pull request, so the guards below are exercised by the same code path
#            that applies.
#   --yes    apply without prompting. For the Org policy workflow, where the gate is the
#            org-policy environment's required reviewer rather than a terminal prompt.
#   default  interactive: shows the current effective policy and asks before writing.
#
# The organisation-scope refusal is unconditional in every mode. The baseline is a record
# of what the organisation enforces, and nothing here should be able to rewrite it.
#
# Applying needs roles/orgpolicy.policyAdmin. Neither organizationAdmin nor project owner
# includes orgpolicy.policy.set -- both stop at .get and .list.

set -uo pipefail

usage() {
  sed -n '3,20p' "$0" | sed 's/^# \{0,1\}//'
}

MODE=interactive
FILE=""

while [ $# -gt 0 ]; do
  case "$1" in
    --check) MODE=check ;;
    --yes) MODE=unattended ;;
    -h | --help)
      usage
      exit 0
      ;;
    -*)
      echo "unknown flag: $1" >&2
      exit 64
      ;;
    *)
      if [ -n "$FILE" ]; then
        echo "only one policy file may be given" >&2
        exit 64
      fi
      FILE="$1"
      ;;
  esac
  shift
done

if [ -z "$FILE" ]; then
  usage >&2
  exit 64
fi

if [ ! -f "$FILE" ]; then
  echo "no such file: $FILE" >&2
  exit 66
fi

# ---------------------------------------------------------------- parse --------
POLICY_NAME=$(awk -F': *' '/^name:/ { gsub(/["'\'']/, "", $2); print $2; exit }' "$FILE")

if [ -z "$POLICY_NAME" ]; then
  echo "$FILE has no top-level 'name:' -- is it an org-policy file?" >&2
  exit 65
fi

CONTAINER_TYPE=${POLICY_NAME%%/*}
CONTAINER_ID=$(printf '%s' "$POLICY_NAME" | cut -d/ -f2)
CONSTRAINT=${POLICY_NAME##*/}

# ---------------------------------------------------------------- guard --------
if [ "$CONTAINER_TYPE" != "projects" ]; then
  echo "REFUSING: $FILE targets '$CONTAINER_TYPE/$CONTAINER_ID'." >&2
  echo "Only project-scoped policies are applied from this repository. Organisation-wide" >&2
  echo "policies are recorded, not applied -- see infra/org-policies/README.md." >&2
  exit 77
fi

# An exception that inherits the parent rule quietly does nothing, so say so loudly. It is
# a warning rather than a refusal because not every project policy is an exception.
if ! grep -qE '^[[:space:]]*inheritFromParent:[[:space:]]*false' "$FILE"; then
  echo "WARNING: $FILE does not set 'inheritFromParent: false'; the inherited" >&2
  echo "organisation rule may merge back in and neutralise this policy." >&2
fi

if [ "$MODE" = check ]; then
  echo "OK  $FILE -> $CONSTRAINT on project $CONTAINER_ID"
  exit 0
fi

if [ "$MODE" = interactive ] && [ ! -t 0 ]; then
  echo "REFUSING: no terminal attached. Use --yes for an unattended apply, or --check to" >&2
  echo "validate without touching the cloud." >&2
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
if [ "$MODE" = interactive ]; then
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
fi

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
