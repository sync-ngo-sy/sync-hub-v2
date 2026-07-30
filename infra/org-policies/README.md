# Organisation policies

Google Cloud organisation policies for `sync.ngo` (organisation `471724145580`), kept here
because `gcloud org-policies set-policy` takes a file as its only interface — so the file
that gets applied may as well be the file that gets reviewed.

The exception that lets Cloud Run serve the public API is **keyed on a resource tag**. The
organisation policy carries two rules: allow any member where the tag
`drs-exception=public-cloud-run` is attached, and the restrictive Workspace-only default
everywhere else. Granting a project the exception is therefore a tag binding, not a policy
write — and that distinction is the whole design, because `roles/orgpolicy.policyAdmin`
exists **only** at organisation scope (confirmed with `gcloud iam list-grantable-roles`,
which offers only `policyViewer` on a project). Anything able to write an organisation
policy can rewrite every constraint in the organisation, including the key-creation ban.
`roles/resourcemanager.tagUser` *is* grantable per project, so automation can flip a
pre-approved exception without ever being able to invent one.

| File | Scope | Applied by |
| --- | --- | --- |
| `org-drs-tag-exception.yaml` | organisation | A human, once, via `scripts/bootstrap-drs-tag-exception.sh`. Never CI. |
| `exception-projects.txt` | — | Nothing. It is the allowlist the attach script enforces. |
| `org-baseline.yaml` | organisation | Nothing — a record of what the organisation enforces. |
| `project-sync-ngo-prod.yaml` | project | Nothing, unless the fallback below is needed. |

## Granting a project the exception

Run the **Org policy** workflow from the Actions tab, choose the project, give a reason.
The run pauses for review, then attaches the tag and records the before-and-after tags in
the run summary. Four things stand between a dispatch and a change, and only the first
lives in a file a repository admin could edit:

1. `github.actor` must be the owner login in the workflow.
2. The `org-policy` environment requires a review before the job starts.
3. Google refuses the token unless it carries this repository, that environment and that
   actor — the provider's attribute condition and the `principalSet` on the service
   account, neither of which lives in this repository.
4. The project must appear in `exception-projects.txt`, so widening the exception is a
   reviewed commit rather than a command someone ran.

Locally, the same thing with a prompt instead of a review:

```bash
./scripts/attach-drs-exception.sh sync-ngo-prod
```

Propagation is usually seconds. Google documents up to about 15 minutes, so give a failure
immediately after a change one retry before concluding anything from it.

## One-time bootstrap

Two scripts, in this order, from a workstation. This is the only organisation-level work,
and it happens once.

```bash
./scripts/bootstrap-drs-tag-exception.sh
```

Creates the tag key and value and rewrites the organisation policy to give the tag its
meaning. It requires a terminal, backs the current policy up first, writes with the live
etag so a concurrent change fails instead of being clobbered, and makes you type the
organisation id. It needs `roles/orgpolicy.policyAdmin` **at the organisation** plus
`roles/resourcemanager.tagAdmin`; today only `bashar@sync.ngo` holds the former, and as
`organizationAdmin` you can grant both to yourself.

```bash
./scripts/bootstrap-ci-org-policy.sh
```

Creates the applier service account, the workload identity pool and provider, the
impersonation binding, and grants `roles/resourcemanager.tagUser` on the tag value and on
the project. Idempotent. Needs `roles/owner` on the project, which `subscription@sync.ngo`
has.

Then, on the GitHub side, create the `org-policy` environment with yourself as a required
reviewer and a deployment branch policy limited to `main`. Leave **prevent self-review**
off — with a single reviewer, enabling it deadlocks every run.

## Verifying it works

The exception is only interesting if an `allUsers` binding actually lands. Deploying a
throwaway service with `--allow-unauthenticated` *is* that binding, so the deploy
succeeding is the test:

```bash
gcloud run deploy drs-probe --image=us-docker.pkg.dev/cloudrun/container/hello --region=europe-west3 --allow-unauthenticated --project=sync-ngo-prod
```

```bash
gcloud run services delete drs-probe --region=europe-west3 --project=sync-ngo-prod --quiet
```

### If the probe fails with the tag attached

Then tag conditions do not cover this constraint, and the fallback is the project-scoped
override in `project-sync-ngo-prod.yaml`:

```bash
./scripts/apply-org-policy.sh infra/org-policies/project-sync-ngo-prod.yaml
```

That is why the file and `apply-org-policy.sh` are still here despite being unused. It
needs organisation-level `policyAdmin` and cannot be automated for the reasons above, so
choosing it means accepting a human step per project.

## Who may change what

Repository ownership governs these *files*; IAM governs the *cloud*. They are different
locks, and `.github/CODEOWNERS` is defence in depth rather than the control.

- The applier service account holds `tagUser` on one tag value and one project. It cannot
  write any organisation policy, alter the exception's shape, or affect another constraint.
- Writing `org-drs-tag-exception.yaml` needs organisation-level `policyAdmin`, held by
  people, not by pipelines.
- Cloud Audit Logs record every `SetOrgPolicy` and every tag binding. Admin Activity logs
  are on by default and cannot be turned off.

The missing compensating control is drift detection — a scheduled, read-only job comparing
live policies and tag bindings against these files. It needs its own viewer-only identity,
because a scheduled run carries no environment claim and so cannot impersonate the applier.

## Migrating to Terraform

When the Terraform bootstrap lands, these become `google_org_policy_policy` for the
organisation policy and `google_tags_tag_key` / `google_tags_tag_value` /
`google_tags_location_tag_binding` for the tag and its bindings. Because they are applied
by CLI first, Terraform will need to adopt rather than create them:

```bash
terraform import google_org_policy_policy.drs organizations/471724145580/policies/iam.allowedPolicyMemberDomains
```

Keep the organisation policy and the tag *definitions* in a human-applied stack with its
own state prefix. Tag *bindings* can live in the environment stack, since attaching a
pre-approved tag is the narrow operation this whole design exists to isolate.
