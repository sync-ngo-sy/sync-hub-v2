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
    # The Platform Portal's gate, and the schedule that guarantees the queue drains.
    "iap.googleapis.com",
    "cloudscheduler.googleapis.com",
    "iam.googleapis.com",
    "iamcredentials.googleapis.com",
    "sts.googleapis.com",
    "logging.googleapis.com",
    "monitoring.googleapis.com",
    # The environment roots read `data.google_project` for the project number the IAP service
    # agent is named after. Without this the very first apply against a new project fails on the
    # data source, before it proposes a single resource.
    "cloudresourcemanager.googleapis.com",
    # The two public portals and the API's hostname are Firebase Hosting sites. The sites
    # themselves are created out of band -- Terraform does not manage them (ADR-0016) -- but the
    # project cannot hold one until these are on.
    "firebase.googleapis.com",
    "firebasehosting.googleapis.com",
  ]

  # The pipeline applies Terraform rather than pushing a revision by hand, so the deployer needs
  # authority over the resources the environment root declares -- and not a scrap more:
  #
  #   run.admin            create services, and set their IAM: run.developer cannot bind invokers
  #   iam.serviceAccountUser  act as the runtime identity the service runs under
  #   secretmanager.admin  create secret *containers*. Values are written out of band, and this
  #                        role cannot read a version's payload -- that is secretAccessor, which
  #                        only the runtime identity holds.
  #   iap.admin            bind who the Platform Portal's gate lets through
  #   firebasehosting.admin  deploy the two static portals
  #
  # Nothing here grants billing, project creation, or organisation-policy authority, so a stolen
  # deploy token cannot widen its own blast radius.
  deployer_roles = [
    "roles/run.admin",
    "roles/iam.serviceAccountUser",
    "roles/secretmanager.admin",
    "roles/iap.admin",
    "roles/firebasehosting.admin",
  ]
  runtime_roles = ["roles/secretmanager.secretAccessor", "roles/logging.logWriter"]

  # The pool is a resource here now, so this follows it rather than restating its path. The
  # provider refuses any token not issued by this repository; these principals narrow that to a
  # named GitHub environment, which is what makes the production gate a review rather than a
  # branch name.
  wif_pool = google_iam_workload_identity_pool.github.name

  github_environments = {
    production = "production"
    staging    = "staging"
  }
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

# ---------------------------------------------------------------- ci -----------
# One identity that may push an image, separate from both deployers. The registry lives in
# production and production promotes what staging validated, so if staging's deployer could write
# to it, staging would be a path into production's artifacts. It cannot: it reads.
resource "google_service_account" "builder" {
  project      = var.production_project
  account_id   = "builder"
  display_name = "CI image builder"
  description  = "Pushes images to Artifact Registry and does nothing else. No keys."

  depends_on = [google_project_service.this]
}

resource "google_artifact_registry_repository_iam_member" "builder_push" {
  project    = google_artifact_registry_repository.images.project
  location   = google_artifact_registry_repository.images.location
  repository = google_artifact_registry_repository.images.name
  role       = "roles/artifactregistry.writer"
  member     = "serviceAccount:${google_service_account.builder.email}"
}

# The pool and its provider were created by hand before this configuration existed, and were
# imported rather than recreated. Everything CI can do rests on them: delete them and every
# deploy stops, with nothing in the repository saying how to rebuild them. That was the reason
# to bring them in.
resource "google_iam_workload_identity_pool" "github" {
  project                   = var.production_project
  workload_identity_pool_id = "github"
  display_name              = "GitHub Actions"

  depends_on = [google_project_service.this]
}

# `attribute_condition` is the outer gate: a token from any other repository is refused here,
# before any principalSet is consulted. The bindings below then narrow that to a named GitHub
# environment, which is what makes the production gate a review rather than a branch name.
resource "google_iam_workload_identity_pool_provider" "sync_hub_v2" {
  project                            = var.production_project
  workload_identity_pool_id          = google_iam_workload_identity_pool.github.workload_identity_pool_id
  workload_identity_pool_provider_id = "sync-hub-v2"
  display_name                       = "sync-ngo-sy/sync-hub-v2"
  attribute_condition                = "assertion.repository=='${var.github_repository}'"

  attribute_mapping = {
    "google.subject"        = "assertion.sub"
    "attribute.actor"       = "assertion.actor"
    "attribute.repository"  = "assertion.repository"
    "attribute.environment" = "assertion.environment"
    "attribute.gate"        = "assertion.environment+\":\"+assertion.actor"
  }

  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }
}

# Applies organisation policy from the Org policy workflow. Separate from every deploy identity:
# policy authority is the one thing a compromised deploy must not be able to widen.
resource "google_service_account" "org_policy_applier" {
  project      = var.production_project
  account_id   = "org-policy-applier"
  display_name = "Org policy applier (GitHub Actions)"
  description  = "Applies project-scoped org policies from sync-ngo-sy/sync-hub-v2. No keys; WIF only."

  depends_on = [google_project_service.this]
}

# Federation, not keys: the organisation forbids creating service-account keys outright, which is
# what makes this the only available shape rather than the preferred one.
resource "google_service_account_iam_member" "deployer_federation" {
  for_each = local.envs

  service_account_id = google_service_account.deployer[each.key].name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${local.wif_pool}/attribute.environment/${local.github_environments[each.key]}"
}

# Both environments, because both build something. Staging builds the API and worker images that
# production later promotes; production builds only the Platform Portal's, whose API hostname is
# compiled in and therefore cannot be promoted from staging's.
resource "google_service_account_iam_member" "builder_federation" {
  for_each = local.github_environments

  service_account_id = google_service_account.builder.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${local.wif_pool}/attribute.environment/${each.value}"
}

# The pipeline applies Terraform, so it needs the state it applies against. Scoped to the bucket
# rather than granted at project level, and the bucket is not managed here -- it cannot be, since
# it holds the state that would manage it.
resource "google_storage_bucket_iam_member" "deployer_state" {
  for_each = local.envs

  bucket = var.state_bucket
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.deployer[each.key].email}"
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
