locals {
  # Static on purpose: everything below uses these keys for for_each, so they must be
  # knowable without applying anything. Project numbers are resolved separately, in value
  # position, where being unknown until apply is fine.
  envs = {
    production = { project_id = var.production_project }
    staging    = { project_id = var.staging_project }
  }

  project_numbers = {
    production = google_project.production.number
    staging    = google_project.staging.number
  }

  # Only what the design uses. The production project also carries APIs enabled long before
  # this existed; those are left alone rather than disabled from under a running service.
  services = [
    "run.googleapis.com",
    "artifactregistry.googleapis.com",
    "secretmanager.googleapis.com",
    "iam.googleapis.com",
    "iamcredentials.googleapis.com",
    "sts.googleapis.com",
    "logging.googleapis.com",
    "monitoring.googleapis.com",
  ]

  deployer_roles = ["roles/run.developer", "roles/iam.serviceAccountUser"]
  runtime_roles  = ["roles/secretmanager.secretAccessor", "roles/logging.logWriter"]
}

# Imported, not created. deletion_policy keeps a stray destroy from taking the project with
# it -- the whole point of two projects is that neither can damage the other.
resource "google_project" "production" {
  name            = var.production_project
  project_id      = var.production_project
  org_id          = var.org_id
  billing_account = var.billing_account
  deletion_policy = "PREVENT"
}

resource "google_project" "staging" {
  name            = var.staging_project
  project_id      = var.staging_project
  org_id          = var.org_id
  billing_account = var.billing_account
  deletion_policy = "PREVENT"
}

resource "google_project_service" "this" {
  for_each = {
    for pair in setproduct(keys(local.envs), local.services) :
    "${pair[0]}/${pair[1]}" => { project = local.envs[pair[0]].project_id, service = pair[1] }
  }

  project = each.value.project
  service = each.value.service

  disable_on_destroy         = false
  disable_dependent_services = false

  depends_on = [google_project.production, google_project.staging]
}

# ---------------------------------------------------------------- registry -----
# One registry, in production, colocated with the services. Staging pulls the identical
# image rather than rebuilding it, which is what makes promotion by digest meaningful.
resource "google_artifact_registry_repository" "images" {
  project       = var.production_project
  location      = var.region
  repository_id = "sync"
  format        = "DOCKER"
  description   = "API and worker images for both environments."

  depends_on = [google_project_service.this]
}

# Cloud Run pulls with the consuming project's own service agent, not with the runtime
# service account, so a cross-project pull needs the staging agent granted read on the
# production repository.
resource "google_artifact_registry_repository_iam_member" "staging_agent_pull" {
  project    = google_artifact_registry_repository.images.project
  location   = google_artifact_registry_repository.images.location
  repository = google_artifact_registry_repository.images.name
  role       = "roles/artifactregistry.reader"
  member     = "serviceAccount:service-${local.project_numbers.staging}@serverless-robot-prod.iam.gserviceaccount.com"
}

resource "google_artifact_registry_repository_iam_member" "deployer_pull" {
  for_each = local.envs

  project    = google_artifact_registry_repository.images.project
  location   = google_artifact_registry_repository.images.location
  repository = google_artifact_registry_repository.images.name
  role       = "roles/artifactregistry.reader"
  member     = "serviceAccount:${google_service_account.deployer[each.key].email}"
}

# ---------------------------------------------------------------- identities ---
# Two per environment and none shared: a deployer that CI impersonates, and a runtime
# identity the service runs as. Nothing in staging can authenticate as anything in
# production.
resource "google_service_account" "deployer" {
  for_each = local.envs

  project      = each.value.project_id
  account_id   = "deployer"
  display_name = "CI deployer (${each.key})"
  description  = "Impersonated by GitHub Actions through workload identity federation. No keys."

  depends_on = [google_project_service.this]
}

resource "google_service_account" "runtime" {
  for_each = local.envs

  project      = each.value.project_id
  account_id   = "runtime"
  display_name = "Cloud Run runtime (${each.key})"
  description  = "Identity the API and worker run as."

  depends_on = [google_project_service.this]
}

resource "google_project_iam_member" "deployer" {
  for_each = {
    for pair in setproduct(keys(local.envs), local.deployer_roles) :
    "${pair[0]}/${pair[1]}" => { env = pair[0], role = pair[1] }
  }

  project = local.envs[each.value.env].project_id
  role    = each.value.role
  member  = "serviceAccount:${google_service_account.deployer[each.value.env].email}"
}

resource "google_project_iam_member" "runtime" {
  for_each = {
    for pair in setproduct(keys(local.envs), local.runtime_roles) :
    "${pair[0]}/${pair[1]}" => { env = pair[0], role = pair[1] }
  }

  project = local.envs[each.value.env].project_id
  role    = each.value.role
  member  = "serviceAccount:${google_service_account.runtime[each.value.env].email}"
}

# ---------------------------------------------------------------- budgets ------
# Notifications go to the billing account's IAM recipients rather than a Cloud Monitoring
# channel, so no notification channel resource has to exist for an alert to arrive.
resource "google_billing_budget" "this" {
  for_each = local.envs

  billing_account = var.billing_account
  display_name    = "${each.key} (${each.value.project_id})"

  budget_filter {
    projects = ["projects/${local.project_numbers[each.key]}"]
  }

  amount {
    specified_amount {
      currency_code = "USD"
      units         = tostring(var.budget_amount)
    }
  }

  dynamic "threshold_rules" {
    for_each = var.budget_thresholds
    content {
      threshold_percent = threshold_rules.value
    }
  }
}
