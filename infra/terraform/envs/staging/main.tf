provider "google" {
  project = var.project
  region  = var.region
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

  name            = each.key
  project         = var.project
  region          = var.region
  image           = each.value.image
  service_account = each.value.service_account
  min_instances   = each.value.min_instances
  max_instances   = each.value.max_instances
  ingress         = each.value.ingress
  public          = each.value.public
  env             = each.value.env
  secret_env      = each.value.secret_env
}
