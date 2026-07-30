# Organisation policies

Google Cloud organisation policies for `sync.ngo` (organisation `471724145580`), kept here
because `gcloud org-policies set-policy` takes a file as its only interface — so the file
that gets applied may as well be the file that gets reviewed.

| File | Scope | Applied? |
| --- | --- | --- |
| `org-baseline.yaml` | organisation | **No — record only.** Transcribed from the live policies so the exception can be read against the default it departs from. |
| `project-sync-ngo-prod.yaml` | project | Yes, by the **Org policy** workflow. The Domain Restricted Sharing exception that lets Cloud Run serve the public API. |

## Applying

Run the **Org policy** workflow from the Actions tab, choose the file, and give a reason.
The run pauses for review, then applies and records the before-and-after effective policy
in the run summary. Nobody needs to run `gcloud` for this.

Three things stand between a dispatch and a write, and only the first lives in a file a
repository admin could edit:

1. `github.actor` must be the owner login in the workflow.
2. The `org-policy` environment requires a review before the job starts.
3. Google refuses the token unless it carries this repository, that environment and that
   actor — enforced by the provider's attribute condition and by the `principalSet` on the
   service account, not by anything in this repository.

Policy changes usually take effect in seconds. Google documents up to about 15 minutes, so
give a failure immediately after a write one retry before concluding anything from it.

### One-time bootstrap

The workflow has no identity until someone creates one, and a workflow cannot create the
identity it authenticates with. So exactly once, from a workstation:

```bash
./scripts/bootstrap-ci-org-policy.sh
```

It enables the APIs, creates the applier service account, creates the workload identity
pool and provider with the conditions above, and grants the role. It is idempotent, and the
same resources can be created by clicking through the Console instead. After that, no
organisation-policy change needs a local `gcloud` again.

Then, on the GitHub side, create the `org-policy` environment with yourself as a required
reviewer and a deployment branch policy limited to `main`. Leave **prevent self-review**
off — with a single reviewer, enabling it deadlocks every run.

### From a workstation (break-glass)

```bash
./scripts/apply-org-policy.sh infra/org-policies/project-sync-ngo-prod.yaml
```

Interactive, and it asks before writing. `--check` validates without touching the cloud —
that is what CI runs on a pull request, so the guards are exercised by the same code path
that applies. Applying this way needs `roles/orgpolicy.policyAdmin` on the account:
neither `roles/resourcemanager.organizationAdmin` nor project `roles/owner` includes
`orgpolicy.policy.set`; both stop at `.get` and `.list`.

## Verifying the exception works

The exception is only interesting if an `allUsers` binding actually lands. Deploying a
throwaway service with `--allow-unauthenticated` *is* that binding, so the deploy
succeeding is the test:

```bash
gcloud run deploy drs-probe --image=us-docker.pkg.dev/cloudrun/container/hello --region=europe-west3 --allow-unauthenticated --project=sync-ngo-prod
```

```bash
gcloud run services delete drs-probe --region=europe-west3 --project=sync-ngo-prod --quiet
```

## Who may change these

Repository ownership governs this *record*; `orgpolicy.policy.set` governs the *policy*.
They are different locks and only the second one stops a policy from being rewritten, so
`.github/CODEOWNERS` here is defence in depth, not the control.

That distinction narrows once CI deploys on merge: from then on a merged change to
`/infra/` or `/.github/workflows/` is an apply, which is why both paths are owned.

### What the applier can do, stated plainly

`roles/orgpolicy.policyAdmin` on `sync-ngo-prod` lets its holder override *any*
organisation-policy constraint on that project — including
`iam.disableServiceAccountKeyCreation`, the constraint that makes federated identity
mandatory in the first place. Google has no way to scope the permission to one constraint,
so the narrowness is procedural rather than technical: the environment review, the
token conditions, and `SetOrgPolicy` entries in Cloud Audit Logs, which are on by default
and cannot be turned off.

The missing compensating control is drift detection — a scheduled, read-only job that
compares the live policies on both projects against the files here and complains about
anything it did not expect. That needs its own viewer-only identity, since a scheduled run
carries no environment claim and so cannot impersonate the applier.

## Migrating to Terraform

These belong in Terraform as `google_org_policy_policy`, one per project, when the
Terraform bootstrap lands. Because the exception is applied by CLI first, Terraform will
need to adopt it rather than create it:

```bash
terraform import google_org_policy_policy.drs_exception projects/sync-ngo-prod/policies/iam.allowedPolicyMemberDomains
```

Keep that stack separate from the environment stack, with its own state prefix and applied
by a human. Setting a project-scoped policy needs `orgpolicy.policy.set` on the project,
and a deploy service account holding it could lift its own domain restriction — at which
point the exception stops being a decision and becomes a capability.

`org-baseline.yaml` stays out of Terraform for the same reason.
