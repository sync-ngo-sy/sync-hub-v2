variable "project" {
  type = string
}

variable "region" {
  type    = string
  default = "europe-west3"
}

variable "secret_ids" {
  description = "Secret containers to create. Values are written out of band and never enter state."
  type        = list(string)
  default     = []
}

variable "images" {
  description = <<-EOT
    Per-service image override, keyed by service name. The pipeline passes what it just built;
    the value pinned in terraform.tfvars is the fallback, so a plan run by hand still means
    something.
  EOT
  type        = map(string)
  default     = {}
}

variable "services" {
  type = map(object({
    image           = string
    service_account = string
    # Per service, because the Platform Portal has to sit in a region that has domain mappings
    # while the API and worker stay next to the database. ADR-0016.
    region                = optional(string)
    protect_from_deletion = optional(bool, true)
    min_instances         = optional(number, 0)
    max_instances         = optional(number, 2)
    ingress               = optional(string, "INGRESS_TRAFFIC_ALL")
    public                = optional(bool, false)
    env                   = optional(map(string), {})
    secret_env            = optional(map(string), {})
    container_port        = optional(number)
    cpu                   = optional(string, "1")
    memory                = optional(string, "512Mi")
    concurrency           = optional(number)
    request_timeout       = optional(string)
    startup_probe_path    = optional(string)
    iap                   = optional(bool, false)
    iap_members           = optional(list(string), [])
    domain                = optional(string)
  }))
  default = {}
}

variable "worker_schedule" {
  description = <<-EOT
    Cron for the drain-and-sweep, or null to create no schedule. Null is for an environment that
    has no worker yet; a deployed one without a schedule strands rows silently.
  EOT
  type        = string
  default     = null
}

variable "scheduler_service_account" {
  description = "Identity Cloud Scheduler mints its OIDC token as. Created in the projects root."
  type        = string
  default     = null
}

variable "alert_email" {
  description = "Group that receives every alert. Membership changes without a production apply."
  type        = string
  default     = "alerts@sync.ngo"
}

variable "uptime_targets" {
  description = "Hostnames probed from Google's edge. Healthy is not always 200 -- see the module."
  type = map(object({
    host            = string
    path            = optional(string, "/")
    accepted_status = optional(number, 200)
  }))
  default = {}
}
