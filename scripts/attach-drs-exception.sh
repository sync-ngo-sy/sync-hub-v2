#!/usr/bin/env bash
# Attaches the domain-restricted-sharing exception tag to a project.
# See https://github.com/sync-ngo-sy/sync-hub-v2/issues/76 and infra/org-policies/README.md
#
#   ./scripts/attach-drs-exception.sh --check sync-ngo-prod
#   ./scripts/attach-drs-exception.sh sync-ngo-prod
#   ./scripts/attach-drs-exception.sh --yes sync-ngo-prod
#
#   --check  allowlist and argument checks only; makes no cloud calls. What CI runs on a
#            pull request, so the guards are exercised by the same code path that attaches.
#   --yes    attach without prompting. For the Org policy workflow, where the gate is the
#            org-policy environment's required reviewer.
#   default  interactive: shows the project's current tags and asks before attaching.
#
# This needs only roles/resourcemanager.tagUser -- on the tag value and on the project.
# It cannot create or alter an organisation policy, so the worst it can do is turn a
# pre-approved exception on for a project that is already listed in exception-projects.txt.
# That is the entire point of the tag design.

set -uo pipefail

ORG=471724145580
TAG_KEY=drs-exception
TAG_VALUE=public-cloud-run
ALLOWLIST=infra/org-policies/exception-projects.txt

NAMESPACED_VALUE="${ORG}/${TAG_KEY}/${TAG_VALUE}"

usage() {
  sed -n '3,18p' "$0" | sed 's/^# \{0,1\}//'
}

MODE=interactive
PROJECT=""

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
      if [ -n "$PROJECT" ]; then
        echo "only one project may be given" >&2
        exit 64
      fi
      PROJECT="$1"
      ;;
  esac
  shift
done

if [ -z "$PROJECT" ]; then
  usage >&2
  exit 64
fi

if [ ! -f "$ALLOWLIST" ]; then
  echo "run this from the repository root; $ALLOWLIST not found" >&2
  exit 66
fi

# ---------------------------------------------------------------- guard --------
# The allowlist is the reviewed artifact. Adding a project to the exception should be a
# commit, not a command someone ran once.
if ! sed 's/#.*//' "$ALLOWLIST" | tr -d '[:blank:]' | grep -qx "$PROJECT"; then
  echo "REFUSING: $PROJECT is not listed in $ALLOWLIST." >&2
  echo "Add it there in a reviewed commit before granting it the exception." >&2
  exit 77
fi

if [ "$MODE" = check ]; then
  echo "OK  $PROJECT is allowed to carry ${NAMESPACED_VALUE}"
  exit 0
fi

if [ "$MODE" = interactive ] && [ ! -t 0 ]; then
  echo "REFUSING: no terminal attached. Use --yes for an unattended attach, or --check to" >&2
  echo "validate without touching the cloud." >&2
  exit 77
fi

PROJECT_NUMBER=$(gcloud projects describe "$PROJECT" --format="value(projectNumber)" 2>/dev/null)
if [ -z "$PROJECT_NUMBER" ]; then
  echo "could not resolve a project number for $PROJECT -- does it exist, and can this" >&2
  echo "account see it? ($(gcloud config get-value account 2>/dev/null))" >&2
  exit 1
fi

PARENT="//cloudresourcemanager.googleapis.com/projects/${PROJECT_NUMBER}"

echo "project : $PROJECT ($PROJECT_NUMBER)"
echo "tag     : $NAMESPACED_VALUE"
echo "account : $(gcloud config get-value account 2>/dev/null)"
echo

echo "--- tags on this project now ---"
BINDINGS=$(gcloud resource-manager tags bindings list --parent="$PARENT" 2>&1)
if [ -z "$BINDINGS" ]; then
  echo "  (none)"
else
  printf '%s\n' "$BINDINGS" | sed 's/^/  /'
fi
echo

if printf '%s' "$BINDINGS" | grep -q "$TAG_VALUE"; then
  echo "Already attached; nothing to do."
  exit 0
fi

# ---------------------------------------------------------------- confirm ------
if [ "$MODE" = interactive ]; then
  printf 'Attach %s to %s? [y/N] ' "$NAMESPACED_VALUE" "$PROJECT"
  read -r REPLY
  case "$REPLY" in
    y | Y) ;;
    *)
      echo "aborted; nothing was attached."
      exit 1
      ;;
  esac
  echo
fi

if ! gcloud resource-manager tags bindings create \
  --tag-value="$NAMESPACED_VALUE" \
  --parent="$PARENT"; then
  echo >&2
  echo "attach failed. Usual causes: the account lacks roles/resourcemanager.tagUser on the" >&2
  echo "tag value or on the project, or the tag does not exist yet -- in which case run" >&2
  echo "scripts/bootstrap-drs-tag-exception.sh first." >&2
  exit 1
fi

# ---------------------------------------------------------------- after --------
echo
echo "--- tags on this project after ---"
gcloud resource-manager tags bindings list --parent="$PARENT" 2>&1 | sed 's/^/  /'
echo
echo "Propagation is usually seconds but is documented at up to ~15 minutes."
echo "Verify with the Cloud Run probe in infra/org-policies/README.md."
