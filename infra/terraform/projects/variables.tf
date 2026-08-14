variable "org_id" {
  type    = string
  default = "471724145580"
}

variable "billing_account" {
  description = <<-EOT
    Billing account the projects attach to, and the one identifier here with no default.

    It is not a credential and knowing it grants nothing, but it names the account that pays for
    everything and this repository is public -- which makes it the most useful line in the file to
    somebody writing a convincing email to a colleague. The rest (org id, project numbers, service
    account addresses) Google already puts in error messages and service-agent addresses.

    Supply it out of band, the same way every secret value is:

        export TF_VAR_billing_account=...

    Only `projects/` needs it. The environment roots never touch billing.
  EOT
  type        = string
}

variable "region" {
  type    = string
  default = "europe-west3"
}

variable "production_project" {
  type    = string
  default = "sync-ngo-prod"
}

variable "staging_project" {
  type    = string
  default = "sync-ngo-staging"
}

variable "state_bucket" {
  description = "Terraform state bucket. Not managed here — it holds the state that would manage it."
  type        = string
  default     = "sync-ngo-tfstate"
}

variable "budget_amount" {
  description = "Monthly budget in USD. Deliberately low: everything here is meant to sit inside free tiers, so any movement is a misconfiguration."
  type        = number
  default     = 5
}

variable "budget_thresholds" {
  description = "Fractions of the budget at which to notify."
  type        = list(number)
  default     = [0.5, 0.9, 1.0]
}

variable "github_repository" {
  description = <<-EOT
    The one repository whose tokens the provider accepts. This is the outer gate: a token from
    anywhere else is refused before any principal binding is consulted.
  EOT
  type        = string
  default     = "sync-ngo-sy/sync-hub-v2"
}

variable "org_admins" {
  description = <<-EOT
    Principals holding organisation-level authority. Authoritative: anything not listed here is
    removed on the next apply.

    One entry is a single point of failure -- lose that account and org recovery goes through
    Google support with proof of domain ownership. The break-glass is Workspace: a super admin can
    always grant themselves organizationAdmin back. Verify that someone still can before trusting
    this list to be short.
  EOT
  type        = list(string)
  default     = ["user:subscription@sync.ngo"]
}

variable "project_creators" {
  description = <<-EOT
    Who may create projects. Currently the whole Workspace domain, which is how five projects
    nobody owns came to exist -- generating a Gemini key in AI Studio creates one silently.

    Narrowing this to a group is the fix, and it breaks AI Studio for everybody not in that group,
    so it is a decision rather than a default.
  EOT
  type        = list(string)
  default     = ["domain:sync.ngo"]
}
