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

variable "services" {
  type = map(object({
    image           = string
    service_account = string
    min_instances   = optional(number, 0)
    max_instances   = optional(number, 2)
    ingress         = optional(string, "INGRESS_TRAFFIC_ALL")
    public          = optional(bool, false)
    env             = optional(map(string), {})
    secret_env      = optional(map(string), {})
  }))
  default = {}
}
