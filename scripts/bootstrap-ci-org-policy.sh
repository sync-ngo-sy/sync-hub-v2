#!/usr/bin/env bash
# One-time bootstrap of the identity the "Org policy" workflow authenticates with.
# See https://github.com/sync-ngo-sy/sync-hub-v2/issues/76 and infra/org-policies/README.md
#
#   ./scripts/bootstrap-ci-org-policy.sh
#
# This has to run from a workstation, once. A workflow cannot create the identity that
# lets the workflow authenticate, so the chicken-and-egg is unavoidable -- but it is the
# only time anyone needs to run gcloud for organisation policy. Everything after this
# happens through the workflow. The same steps can be clicked through in the Console if
# you would rather not run a shell script; the resource names below are what to create.
#
# Run as an account with roles/owner on the project (subscription@sync.ngo has it) plus
# roles/resourcemanager.organizationAdmin, which is what allows granting policyAdmin.
#
# Re-running is safe: every step checks for what it creates.
#
# WHAT THIS GRANTS, STATED PLAINLY: roles/orgpolicy.policyAdmin on sync-ngo-prod lets the
# holder override *any* organisation-policy constraint on that project, not only domain
# restricted sharing. That includes iam.disableServiceAccountKeyCreation. The controls that
# keep it narrow are the org-policy environment's required reviewer, the attribute
# condition pinning the token to this repository, and the principalSet pinning it to that
# environment and to one GitHub actor. Cloud Audit Logs record every SetOrgPolicy call.

set -uo pipefail

PROJECT=sync-ngo-prod
PROJECT_NUMBER=870458118919
POOL=github
PROVIDER=sync-hub-v2
SA_ID=org-policy-applier
REPO=sync-ngo-sy/sync-hub-v2
ENVIRONMENT=org-policy
ACTOR=abdulqdaer-q

SA_EMAIL="${SA_ID}@${PROJECT}.iam.gserviceaccount.com"
POOL_PATH="projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL}"

echo "project     : $PROJECT ($PROJECT_NUMBER)"
echo "repository  : $REPO"
echo "environment : $ENVIRONMENT"
echo "actor       : $ACTOR"
echo "account     : $(gcloud config get-value account 2>/dev/null)"
echo

# ---------------------------------------------------------------- apis ---------
echo "--- APIs ---"
gcloud services enable orgpolicy.googleapis.com sts.googleapis.com iamcredentials.googleapis.com \
  --project="$PROJECT" || exit 1

# ---------------------------------------------------------------- account ------
echo "--- service account ---"
if gcloud iam service-accounts describe "$SA_EMAIL" --project="$PROJECT" >/dev/null 2>&1; then
  echo "  exists: $SA_EMAIL"
else
  gcloud iam service-accounts create "$SA_ID" \
    --project="$PROJECT" \
    --display-name="Org policy applier (GitHub Actions)" \
    --description="Applies project-scoped org policies from ${REPO}. No keys; WIF only." || exit 1
fi

# ---------------------------------------------------------------- pool ---------
echo "--- workload identity pool ---"
if gcloud iam workload-identity-pools describe "$POOL" \
  --location=global --project="$PROJECT" >/dev/null 2>&1; then
  echo "  exists: $POOL"
else
  gcloud iam workload-identity-pools create "$POOL" \
    --location=global --project="$PROJECT" \
    --display-name="GitHub Actions" || exit 1
fi

# `attribute.gate` exists so the impersonation binding below can require the environment
# AND the actor together. A principalSet can only match one attribute, so the two claims
# are mapped into one value.
echo "--- provider ---"
if gcloud iam workload-identity-pools providers describe "$PROVIDER" \
  --workload-identity-pool="$POOL" --location=global --project="$PROJECT" >/dev/null 2>&1; then
  echo "  exists: $PROVIDER"
else
  gcloud iam workload-identity-pools providers create-oidc "$PROVIDER" \
    --workload-identity-pool="$POOL" --location=global --project="$PROJECT" \
    --display-name="$REPO" \
    --issuer-uri="https://token.actions.githubusercontent.com" \
    --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.environment=assertion.environment,attribute.actor=assertion.actor,attribute.gate=assertion.environment+\":\"+assertion.actor" \
    --attribute-condition="assertion.repository=='${REPO}'" || exit 1
fi

# ---------------------------------------------------------------- binding ------
echo "--- impersonation binding ---"
gcloud iam service-accounts add-iam-policy-binding "$SA_EMAIL" \
  --project="$PROJECT" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/${POOL_PATH}/attribute.gate/${ENVIRONMENT}:${ACTOR}" \
  --condition=None >/dev/null || exit 1
echo "  only tokens from ${REPO} carrying environment=${ENVIRONMENT} and actor=${ACTOR}"
echo "  may impersonate ${SA_EMAIL}"

# ---------------------------------------------------------------- role ---------
echo "--- policy admin on the project ---"
gcloud projects add-iam-policy-binding "$PROJECT" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/orgpolicy.policyAdmin" \
  --condition=None >/dev/null || exit 1
echo "  granted roles/orgpolicy.policyAdmin on ${PROJECT} (project scope, not organisation)"

# ---------------------------------------------------------------- next ---------
cat <<NEXT

Done. The workflow expects exactly these, and they are already its defaults:

  GCP_PROJECT        ${PROJECT}
  GCP_PROJECT_NUMBER ${PROJECT_NUMBER}
  WIF_POOL           ${POOL}
  WIF_PROVIDER       ${PROVIDER}
  APPLY_SA           ${SA_EMAIL}

None of those are secrets, so no repository secrets are needed. Remaining manual step, on
the GitHub side: create the '${ENVIRONMENT}' environment with ${ACTOR} as a required
reviewer and a deployment branch policy limited to main. Leave "prevent self-review" off --
with a single reviewer, turning it on deadlocks every run.
NEXT
