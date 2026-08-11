variable "name" {
  description = "Cloud Run service name."
  type        = string
}

variable "project" {
  type = string
}

variable "project_number" {
  description = "Google's own service agents are named after the number, not the id."
  type        = string
}

variable "region" {
  type = string
}

variable "image" {
  description = "Fully qualified image, by digest in production."
  type        = string
}

variable "service_account" {
  description = "Runtime service account email."
  type        = string
}

variable "protect_from_deletion" {
  description = <<-EOT
    Refuse to delete the service. Defaults on, so an environment has to opt out in its tfvars
    rather than opt in: the failure this guards is a plan that quietly proposes a replacement of a
    live service, and production is the one place nobody is watching for it.
  EOT
  type        = bool
  default     = true
}

variable "min_instances" {
  type    = number
  default = 0
}

variable "max_instances" {
  type    = number
  default = 2
}

variable "ingress" {
  type    = string
  default = "INGRESS_TRAFFIC_ALL"
}

variable "public" {
  description = "Bind allUsers as invoker. Only possible where the project carries the domain-sharing exception tag."
  type        = bool
  default     = false
}

variable "env" {
  description = "Plain environment variables."
  type        = map(string)
  default     = {}
}

variable "secret_env" {
  description = "Environment variable name to Secret Manager secret id. Values are written out of band."
  type        = map(string)
  default     = {}
}

variable "container_port" {
  description = <<-EOT
    Port the container listens on. Cloud Run defaults to 8080 and passes PORT; the API ignores
    PORT and hardcodes 8000, so leaving this unset for it means the revision never turns healthy.
  EOT
  type        = number
  default     = null
}

variable "cpu" {
  type    = string
  default = "1"
}

variable "memory" {
  type    = string
  default = "512Mi"
}

variable "concurrency" {
  description = <<-EOT
    Requests one instance serves at once. High for the worker deliberately: a burst of enqueue
    notifications then coalesces into a few draining instances instead of one per event, and it is
    the instance count, not the request count, that consumes the database's connection limit.
  EOT
  type        = number
  default     = null
}

variable "request_timeout" {
  description = "Ceiling on one request, as a duration string. A drain is slower than a page load."
  type        = string
  default     = null
}

variable "startup_probe_path" {
  description = "Path that must answer before a revision takes traffic. Unset leaves Cloud Run's TCP check."
  type        = string
  default     = null
}

variable "iap" {
  description = <<-EOT
    Put Identity-Aware Proxy in front of the service, which needs the service to stay private:
    IAP becomes the caller, so `public` must be false or the gate is decorative.
  EOT
  type        = bool
  default     = false
}

variable "iap_members" {
  description = "Principals allowed through the gate, e.g. `domain:sync.ngo`. Ignored unless `iap`."
  type        = list(string)
  default     = []
}

variable "domain" {
  description = <<-EOT
    Hostname mapped straight to the service, with no load balancer. Mappings exist in only ten
    regions and europe-west3 is not one of them, so a service setting this is deployed to a region
    that has them -- see ADR-0016.
  EOT
  type        = string
  default     = null
}
