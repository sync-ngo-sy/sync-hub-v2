variable "org_id" {
  type    = string
  default = "471724145580"
}

variable "billing_account" {
  type    = string
  default = "0146E0-8E025A-3D8296"
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
