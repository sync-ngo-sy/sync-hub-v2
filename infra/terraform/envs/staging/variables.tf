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
