variable "project" {
  type = string
}

variable "environment" {
  description = "Named in every alert subject, because one inbox receives both environments."
  type        = string
}

variable "alert_email" {
  description = <<-EOT
    Where every alert goes. A Google Group rather than a person: membership changes without a
    production apply, and the group keeps the archive that answers "when did this start?".
  EOT
  type        = string
}

variable "uptime_targets" {
  description = <<-EOT
    Hostnames to probe from Google's edge.

    `accepted_status` exists because healthy is not always 200. The Platform Portal sits behind
    IAP and answers 302 to a Google sign-in, so a check that only accepts 200 pages forever.
  EOT
  type = map(object({
    host            = string
    path            = optional(string, "/")
    accepted_status = optional(number, 200)
  }))
  default = {}
}

variable "worker_silent_after_seconds" {
  description = <<-EOT
    How long without a scheduled run before the worker counts as dead.

    The schedule ticks every 3 minutes, so this is four missed ticks. Tighter than that alerts on
    a single cold start; looser and a stopped worker sits unnoticed through a working day.
  EOT
  type        = number
  default     = 900
}
