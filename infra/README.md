# Infrastructure

| | |
| --- | --- |
| `org-policies/` | Google Cloud organisation policies, including the domain-sharing exception |
| `terraform/` | OpenTofu configuration, state bucket, per-environment roots |

## Identifiers

| | |
| --- | --- |
| GCP organisation | `sync.ngo` — `471724145580` |
| GCP production project | `sync-ngo-prod` — `870458118919` |
| GCP staging project | not yet created — #84 |
| Terraform state | `gs://sync-ngo-tfstate` (europe-west3) |
| Supabase organisation | `SYNC Ngo` — `ujgwulmznnskrqfdqtxs` |
| Supabase production | `sync-hub-prod` — `skmsobeqyljduzkjmokr` (eu-central-1) |
| Supabase staging | `sync-hub-staging` — `qjsqmtemyhvtnurohckb` (eu-central-1) |

## Scripts

| | |
| --- | --- |
| `bootstrap-terraform-state.sh` | Creates the state bucket. Once. |
| `bootstrap-drs-tag-exception.sh` | Creates the exception tag and rewrites the organisation policy. Once. |
| `bootstrap-ci-org-policy.sh` | Federated identity for the Org policy workflow. Idempotent. |
| `attach-drs-exception.sh` | Grants a project the domain-sharing exception. |
| `apply-org-policy.sh` | Applies a project-scoped organisation policy. Fallback path. |
| `reset-staging-db.sh` | Replays migrations against staging. Refuses production. |
