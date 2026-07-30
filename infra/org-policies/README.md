# Organisation policies

Google Cloud organisation policies for `sync.ngo` (organisation `471724145580`), kept here
because `gcloud org-policies set-policy` takes a file as its only interface — so the file
that gets applied may as well be the file that gets reviewed.

| File | Scope | Applied? |
| --- | --- | --- |
| `org-baseline.yaml` | organisation | **No — record only.** Transcribed from the live policies so the exception can be read against the default it departs from. |
| `project-sync-ngo-prod.yaml` | project | Yes, by hand. The Domain Restricted Sharing exception that lets Cloud Run serve the public API. |

## Applying

```bash
./scripts/apply-org-policy.sh infra/org-policies/project-sync-ngo-prod.yaml
```

The script refuses organisation-scoped files, prints the effective policy before and
after, and asks before writing.

Two things must be true first:

- **The Organization Policy API is enabled on the target project.** It is not, by default:
  `gcloud services enable orgpolicy.googleapis.com --project=sync-ngo-prod`.
- **The active account holds `roles/orgpolicy.policyAdmin`.** `roles/resourcemanager.organizationAdmin`
  is *not* sufficient — it grants `orgpolicy.policy.get` and `.list` but not
  `orgpolicy.policy.set`. It does include `resourcemanager.organizations.setIamPolicy`,
  so an organisation admin can grant themselves the role; no external administrator is
  needed, but it is a distinct step.

Policy changes usually take effect in seconds. Google documents up to about 15 minutes, so
give a failure immediately after a write one retry before concluding anything from it.

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
