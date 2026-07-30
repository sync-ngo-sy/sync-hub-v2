#!/usr/bin/env bash
# One-time, human-run: creates the exception tag and rewrites the organisation policy for
# Domain Restricted Sharing so the exception is keyed on that tag.
# See https://github.com/sync-ngo-sy/sync-hub-v2/issues/76 and infra/org-policies/README.md
#
#   ./scripts/bootstrap-drs-tag-exception.sh
#
# This is the only thing in the repository that writes an organisation-scoped policy, and
# it is deliberately interactive: it requires a terminal, prints the current policy, takes
# a backup, and asks you to type the organisation id before writing. CI can never run it.
#
# It needs roles/orgpolicy.policyAdmin AT THE ORGANISATION, which is the only scope the
# role can be granted at. Today only bashar@sync.ngo holds it. As organizationAdmin you can
# grant it to yourself:
#
#   gcloud organizations add-iam-policy-binding 471724145580 \
#     --member="user:subscription@sync.ngo" --role="roles/orgpolicy.policyAdmin"
#
# Creating the tag additionally needs roles/resourcemanager.tagAdmin at the organisation,
# grantable the same way.
#
# After this runs once, nobody needs organisation-level authority again: granting a project
# the exception becomes a tag binding, which scripts/attach-drs-exception.sh and the Org
# policy workflow can do with roles/resourcemanager.tagUser alone.

set -uo pipefail

ORG=471724145580
TAG_KEY=drs-exception
TAG_VALUE=public-cloud-run
CONSTRAINT=iam.allowedPolicyMemberDomains
POLICY_FILE=infra/org-policies/org-drs-tag-exception.yaml

NAMESPACED_KEY="${ORG}/${TAG_KEY}"
NAMESPACED_VALUE="${NAMESPACED_KEY}/${TAG_VALUE}"

if [ ! -t 0 ]; then
  echo "REFUSING: no terminal attached. This writes an organisation-scoped policy and is" >&2
  echo "deliberately interactive." >&2
  exit 77
fi

if [ ! -f "$POLICY_FILE" ]; then
  echo "run this from the repository root; $POLICY_FILE not found" >&2
  exit 66
fi

echo "organisation : $ORG"
echo "tag          : ${NAMESPACED_VALUE}"
echo "constraint   : $CONSTRAINT"
echo "account      : $(gcloud config get-value account 2>/dev/null)"
echo

# ---------------------------------------------------------------- tag ----------
echo "--- tag key ---"
if gcloud resource-manager tags keys describe "$NAMESPACED_KEY" >/dev/null 2>&1; then
  echo "  exists: $NAMESPACED_KEY"
else
  gcloud resource-manager tags keys create "$TAG_KEY" \
    --parent="organizations/${ORG}" \
    --description="Marks resources granted a scoped exception to domain restricted sharing." || exit 1
fi

echo "--- tag value ---"
if gcloud resource-manager tags values describe "$NAMESPACED_VALUE" >/dev/null 2>&1; then
  echo "  exists: $NAMESPACED_VALUE"
else
  gcloud resource-manager tags values create "$TAG_VALUE" \
    --parent="$NAMESPACED_KEY" \
    --description="May bind allUsers so Cloud Run can serve the public API." || exit 1
fi

# ---------------------------------------------------------------- backup -------
WORKDIR=$(mktemp -d -t drs-org-policy)
BACKUP="${WORKDIR}/backup.yaml"
PAYLOAD="${WORKDIR}/payload.yaml"

echo
echo "--- current organisation policy (backed up) ---"
if ! gcloud org-policies describe "$CONSTRAINT" --organization="$ORG" >"$BACKUP" 2>&1; then
  cat "$BACKUP" >&2
  echo "could not read the current policy; nothing was changed." >&2
  exit 1
fi
sed 's/^/  /' "$BACKUP"
echo
echo "  backup: $BACKUP"

# The live etag goes into the payload so a concurrent change fails the write instead of
# being silently overwritten. Fetched rather than committed, because it changes on every
# write -- and read by field name, because describe prints two different etags: a
# top-level one with a trailing '-' and the spec one, which is the only one set-policy
# accepts. Parsing the first 'etag:' line out of the YAML picks the wrong one.
ETAG=$(gcloud org-policies describe "$CONSTRAINT" --organization="$ORG" --format="value(spec.etag)" 2>/dev/null)
if [ -z "$ETAG" ]; then
  echo "could not read spec.etag from the current policy; refusing to write blind." >&2
  exit 1
fi

awk -v etag="$ETAG" '{ print } /^spec:/ { print "  etag: " etag }' "$POLICY_FILE" >"$PAYLOAD"

echo
echo "--- to be applied ---"
sed 's/^/  /' "$PAYLOAD"
echo

# ---------------------------------------------------------------- confirm ------
cat <<WARN
This replaces the organisation-wide policy for $CONSTRAINT. Read the rules above and
check that the unconditional rule still carries the Workspace customer id -- without it,
every project in the organisation loses the domain restriction.

WARN
printf 'Type the organisation id (%s) to apply, anything else to abort: ' "$ORG"
read -r REPLY
if [ "$REPLY" != "$ORG" ]; then
  echo "aborted; nothing was written."
  exit 1
fi
echo

if ! gcloud org-policies set-policy "$PAYLOAD"; then
  echo >&2
  echo "set-policy failed. Usual causes: the account lacks roles/orgpolicy.policyAdmin at" >&2
  echo "the organisation, or the etag went stale because the policy changed under us." >&2
  echo "Nothing was partially written -- set-policy replaces the policy atomically." >&2
  exit 1
fi

# ---------------------------------------------------------------- after --------
echo
echo "--- organisation policy now ---"
gcloud org-policies describe "$CONSTRAINT" --organization="$ORG" 2>&1 | sed 's/^/  /'

cat <<NEXT

Done. The exception now exists as a shape, attached to nothing.

Next:
  1. ./scripts/bootstrap-ci-org-policy.sh      grants the applier tagUser on the tag
  2. Run the Org policy workflow, or locally:
     ./scripts/attach-drs-exception.sh sync-ngo-prod
  3. Verify with the Cloud Run probe in infra/org-policies/README.md. If an allUsers
     binding is still refused with the tag attached, tag conditions do not cover this
     constraint and the fallback is the project-scoped policy in
     infra/org-policies/project-sync-ngo-prod.yaml.

To roll back: delete the 'etag:' line from $BACKUP and
  gcloud org-policies set-policy $BACKUP
NEXT
