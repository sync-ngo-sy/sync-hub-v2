# Terraform

```
modules/service/      one Cloud Run service, reused by both environments
envs/staging/         staging root module   — state prefix envs/staging
envs/production/      production root module — state prefix envs/production
```

State lives in `gs://sync-ngo-tfstate` (europe-west3, versioned, public access prevented),
one prefix per environment. The bucket cannot be managed by the state it holds, so it is
created once by `scripts/bootstrap-terraform-state.sh`.

Google is the only provider, pinned in each root module with `.terraform.lock.hcl`
committed.

## Running

```bash
cd infra/terraform/envs/staging && terraform init && terraform plan
```

`terraform.tfvars` in each environment carries what differs. `services` and `secret_ids` are
empty until #88 and #84 fill them, so a plan today reports no changes.

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

Resources created by hand before this existed — the workload identity pool and provider, the
applier service account, the exception tag — are not in state yet and need `terraform import`
when the stack that owns them is written.
