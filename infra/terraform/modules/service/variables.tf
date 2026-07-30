variable "name" {
  description = "Cloud Run service name."
  type        = string
}

variable "project" {
  type = string
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
