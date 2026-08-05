provider "google" {
  project = var.project
  region  = var.region
}

# Google's service agents are named after the project number, which nothing here knows by hand.
data "google_project" "this" {
  project_id = var.project
}

# Containers only. A google_secret_manager_secret_version with a real value would put that
# value in state, which is the one thing infra/terraform/README.md forbids.
resource "google_secret_manager_secret" "this" {
  for_each = toset(var.secret_ids)

  project   = var.project
  secret_id = each.value

  replication {
    user_managed {
      replicas {
        location = var.region
      }
    }
  }
}

module "service" {
  source   = "../../modules/service"
  for_each = var.services

  name               = each.key
  project            = var.project
  project_number     = data.google_project.this.number
  region             = coalesce(each.value.region, var.region)
  image              = coalesce(lookup(var.images, each.key, null), each.value.image)
  service_account    = each.value.service_account
  min_instances      = each.value.min_instances
  max_instances      = each.value.max_instances
  ingress            = each.value.ingress
  public             = each.value.public
  env                = each.value.env
  secret_env         = each.value.secret_env
  container_port     = each.value.container_port
  cpu                = each.value.cpu
  memory             = each.value.memory
  concurrency        = each.value.concurrency
  request_timeout    = each.value.request_timeout
  startup_probe_path = each.value.startup_probe_path
  iap                = each.value.iap
  iap_members        = each.value.iap_members
  domain             = each.value.domain
}

output "service_uris" {
  value = { for name, service in module.service : name => service.uri }
}

# Empty for every service but the Platform Portal, which is the only mapped hostname. These are
# the records to add at the registrar (#86).
output "dns_records" {
  value = { for name, service in module.service : name => service.dns_records if length(service.dns_records) > 0 }
}
