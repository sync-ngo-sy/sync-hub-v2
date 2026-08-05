# Terraform

```
projects/             both projects, APIs, registry, identities, budgets — state prefix projects
modules/service/      one Cloud Run service, reused by both environments
envs/staging/         staging root module   — state prefix envs/staging
envs/production/      production root module — state prefix envs/production
```

`projects/` applies first: the environment roots manage resources *inside* projects that it
creates. Production already exists and is adopted rather than created:

```bash
cd infra/terraform/projects && tofu import google_project.production sync-ngo-prod
```

Applying it needs, on the billing account `0146E0-8E025A-3D8296`, permission to attach
billing to a new project and to manage budgets — `roles/billing.user` and
`roles/billing.costsManager`, or `roles/billing.admin` for both. Budget alerts go to the
billing account's IAM recipients, so no notification channel has to exist.

State lives in `gs://sync-ngo-tfstate` (europe-west3, versioned, public access prevented),
one prefix per environment. The bucket cannot be managed by the state it holds, so it is
created once by `scripts/bootstrap-terraform-state.sh`.

Google is the only provider, pinned in each root module with `.terraform.lock.hcl`
committed.

## Tooling

OpenTofu (`brew install opentofu`), not Terraform. Homebrew dropped the `terraform` formula
after the BUSL relicence, so Terraform now needs a third-party tap; OpenTofu is in core, is
MPL-licensed, and is a drop-in. The lockfiles therefore record
`registry.opentofu.org/hashicorp/google` — switching to Terraform means regenerating them.

## Running

```bash
cd infra/terraform/envs/staging && tofu init && tofu plan
```

The `gcs` backend authenticates with application default credentials, which are separate
from your `gcloud` login: `gcloud auth application-default login`.

`terraform.tfvars` in each environment carries what differs: three services — the API, the
worker, and the Platform Portal's static server — plus the secret containers they read.

Images are pinned in `terraform.tfvars` so a plan run by hand still means something, and
overridden per apply by the pipeline:

```bash
tofu apply -var='images={api="…/api:'$SHA'",worker="…/worker:'$SHA'"}'
```

Staging pins tags and production pins digests, because production promotes the artifact staging
validated rather than rebuilding it (#91).

## Two conventions

**Secret values never enter Terraform.** State stores them in plaintext, which would make the
state bucket the most sensitive object in the account. Terraform creates the
`google_secret_manager_secret` container; the version holding the value is written out of
band, by hand or by a deploy step.

**DNS is not managed here.** Records stay at the existing external provider and are added by
hand — see #86. Nothing is missing by accident.

## Notes

`public = true` on a service binds `allUsers` as invoker, which only works in a project
carrying the domain-sharing exception tag — see `infra/org-policies/`.

The worker is `public = true` on purpose, not by oversight. The database webhook that announces an
enqueue is Postgres calling out, and Postgres cannot mint a Google identity token, so
`X-Worker-Secret` stands in for IAM. Its endpoints fail closed when the secret is unset.

`iap = true` requires the service to stay private — IAP becomes the caller, so a service that is
also `public` has a decorative gate. Only the Platform Portal uses it.

`domain` maps a hostname straight to a service with no load balancer, and mappings exist in ten
regions of which `europe-west3` is not one. That is why the Platform Portal's service sets
`region = "europe-west1"` while everything else stays in Frankfurt; ADR-0012 has the reasoning, and
it ends in a cookie rather than in latency.

Resources created by hand before this existed — the workload identity pool and provider, the
applier service account, the exception tag — are not in state yet and need `terraform import`
when the stack that owns them is written.
