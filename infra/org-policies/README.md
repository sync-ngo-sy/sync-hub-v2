# Organisation policies

Google Cloud organisation policies for `sync.ngo` (organisation `471724145580`).
`gcloud org-policies set-policy` takes a file as its only interface, so the applied files
live here.

The Domain Restricted Sharing policy carries two rules: allow any member where the tag
`drs-exception=public-cloud-run` is attached, and the Workspace-only default everywhere
else. Granting a project the exception is a tag binding, not a policy write.

| File | Scope | Applied by |
| --- | --- | --- |
| `org-drs-tag-exception.yaml` | organisation | A human, once, via `scripts/bootstrap-drs-tag-exception.sh`. Never CI. |
| `exception-projects.txt` | — | Nothing. The allowlist `attach-drs-exception.sh` enforces. |
| `org-baseline.yaml` | organisation | Nothing — a record of what the organisation enforces. |
| `project-sync-ngo-prod.yaml` | project | Nothing, unless the fallback below is needed. |

## What exists

| | |
| --- | --- |
| Tag key | `tagKeys/281479039958491` — `471724145580/drs-exception` |
| Tag value | `tagValues/281481741423634` — `public-cloud-run` |
| Tagged projects | `sync-ngo-prod` |
| Applier identity | `org-policy-applier@sync-ngo-prod.iam.gserviceaccount.com` |
| Federation | pool `github`, provider `sync-hub-v2`, gated on `environment:actor` |
| Applier roles | `resourcemanager.tagUser` on the tag value and on the project |

## Granting a project the exception

Run the **Org policy** workflow from the Actions tab, choose the project, give a reason. The
run pauses for review from the owner, then attaches the tag and records the before-and-after
tags in the run summary. The project must be listed in `exception-projects.txt` first.

Locally, with a prompt instead of a review:

```bash
./scripts/attach-drs-exception.sh sync-ngo-prod
```

Tag propagation is usually seconds and documented at up to 15 minutes. Give a refused
binding one retry before treating it as a failure.

## One-time bootstrap

```bash
./scripts/bootstrap-drs-tag-exception.sh
```

Creates the tag and rewrites the organisation policy. Interactive, takes a backup, writes
with the live etag. Needs `roles/orgpolicy.policyAdmin` and
`roles/resourcemanager.tagAdmin` **at the organisation** — `policyAdmin` is not grantable at
project scope.

```bash
./scripts/bootstrap-ci-org-policy.sh
```

Creates the applier service account, the workload identity pool and provider, the
impersonation binding, and the `tagUser` grants. Idempotent. Needs `roles/owner` on the
project.

Then create the `org-policy` GitHub environment with the owner as a required reviewer and a
deployment branch policy limited to `main`. Leave **prevent self-review** off — with a
single reviewer, enabling it deadlocks every run.

## Verifying

`--allow-unauthenticated` *is* the `allUsers` binding, so the deploy succeeding is the test:

```bash
gcloud run deploy drs-probe --image=us-docker.pkg.dev/cloudrun/container/hello --region=europe-west3 --allow-unauthenticated --project=sync-ngo-prod
```

```bash
gcloud run services delete drs-probe --region=europe-west3 --project=sync-ngo-prod --quiet
```

## Fallback

If the tag route stops working, `project-sync-ngo-prod.yaml` is a project-scoped override
applied with `./scripts/apply-org-policy.sh`. It needs organisation-level `policyAdmin` and
cannot be automated.

## Migrating to Terraform

These become `google_org_policy_policy` for the organisation policy and
`google_tags_tag_key` / `google_tags_tag_value` / `google_tags_location_tag_binding` for the
tag and its bindings. Applied by CLI first, so Terraform adopts rather than creates:

```bash
terraform import google_org_policy_policy.drs organizations/471724145580/policies/iam.allowedPolicyMemberDomains
```

Keep the organisation policy and tag definitions in a human-applied stack with its own state
prefix; tag bindings can live in the environment stack.
