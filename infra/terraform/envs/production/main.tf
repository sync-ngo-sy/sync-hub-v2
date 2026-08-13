locals {
  worker_audience = "https://sync-hub-worker/${var.project}"

  # Derived rather than declared: a hand-set name is one more thing that can disagree
  # with the project it labels, and this appears in the subject line of every alert.
  environment = replace(var.project, "sync-ngo-", "")
}

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

  name                  = each.key
  project               = var.project
  project_number        = data.google_project.this.number
  region                = coalesce(each.value.region, var.region)
  image                 = coalesce(lookup(var.images, each.key, null), each.value.image)
  service_account       = each.value.service_account
  protect_from_deletion = each.value.protect_from_deletion

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

# ---------------------------------------------------------------- schedule -----
# The guarantee that nothing is stranded. A notification can be missed; a job that runs every
# few minutes cannot miss the same row forever -- which is why this belongs in code rather than
# in whatever somebody typed once.
#
# It carries no secret. Cloud Scheduler signs an OIDC token as the scheduler account and the
# worker checks the signature, the audience and the account, so nothing sensitive lands in
# Terraform state. The database webhook still uses the shared secret, because Postgres cannot
# mint a token -- that one stays out of band.
resource "google_cloud_scheduler_job" "worker_drain" {
  count = var.worker_schedule == null ? 0 : 1

  project     = var.project
  region      = var.region
  name        = "worker-drain"
  description = "Drains and sweeps the worker queues. See #278."
  schedule    = var.worker_schedule
  time_zone   = "Etc/UTC"

  # A drain is slower than a page load, and a burst can take minutes. Stopping early is safe --
  # the next tick picks up whatever is left -- but cutting a job off mid-row is not.
  attempt_deadline = "900s"

  retry_config {
    retry_count = 1
  }

  http_target {
    uri         = "${module.service["worker"].uri}/scheduled"
    http_method = "POST"

    # An audience of our choosing rather than the service URL: the URL is only known after the
    # service is created, and referring to it from the service's own configuration is a cycle.
    # The value is arbitrary as long as the token and the worker agree on it.
    oidc_token {
      service_account_email = var.scheduler_service_account
      audience              = local.worker_audience
    }
  }
}

module "monitoring" {
  source = "../../modules/monitoring"

  project        = var.project
  environment    = local.environment
  alert_email    = var.alert_email
  uptime_targets = var.uptime_targets
}

output "monitoring_dashboard" {
  description = "Where to look when an alert fires."
  value       = module.monitoring.dashboard_url
}
